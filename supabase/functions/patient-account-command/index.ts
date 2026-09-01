import { handleOptions } from "../_shared/auth/cors.ts";
import { getRuntime, getServiceRoleKey } from "../_shared/auth/runtime.ts";
import { updateAuthUserPassword } from "../_shared/auth/users.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requirePatient,
  success,
} from "../_shared/payments/http.ts";

const runtime = getRuntime("patient-account-command");
const bucket = "patient-public-media";
const maxAvatarBytes = 5 * 1024 * 1024;

type Address = {
  city: string;
  complement: string;
  neighborhood: string;
  postalCode: string;
  state: string;
  street: string;
  streetNumber: string;
};

type PatientProfileRow = {
  avatar_url: string | null;
  display_name: string;
  id: string;
  metadata: unknown;
  phone: string | null;
  phone_country_code: string | null;
};

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const requestId = crypto.randomUUID();

  try {
    if (request.method !== "POST") {
      throw new DomainError("method_not_allowed", 405, "Método não permitido.");
    }

    const supabaseUrl = runtime.env.get("SUPABASE_URL");
    const serviceRoleKey = getServiceRoleKey(runtime);
    if (!supabaseUrl || !serviceRoleKey) {
      throw new DomainError("unavailable", 503, "Configuração indisponível.");
    }

    const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
    const { profile, user } = await requirePatient(client, request);
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      if (formData.get("action") !== "upload_avatar") {
        throw new DomainError("invalid_action", 422, "Ação inválida.");
      }
      return success(
        await uploadAvatar({
          client,
          file: formData.get("file"),
          profileId: profile.id,
          supabaseUrl,
          userId: user.id,
          serviceRoleKey,
        }),
      );
    }

    const command = await parseJsonBody<CommandBody>(request);
    if (!command || typeof command.action !== "string") {
      throw new DomainError("invalid_payload", 422, "Dados inválidos.");
    }

    if (command.action === "change_password") {
      if (!isPasswordPayload(command.payload)) {
        throw new DomainError(
          "invalid_password",
          422,
          "Use pelo menos 8 caracteres e confirme a nova senha.",
        );
      }
      await updateAuthUserPassword(client, user.id, command.payload.password);
      return success({ changed: true });
    }

    if (command.action !== "update_profile") {
      throw new DomainError("invalid_action", 422, "Ação inválida.");
    }

    const payload = parseProfilePayload(command.payload);
    const currentRows = await client.get<PatientProfileRow[]>(
      `/rest/v1/patient_profiles?select=id,display_name,phone,phone_country_code,avatar_url,metadata&id=eq.${encodeURIComponent(
        profile.id,
      )}&limit=1`,
    );
    const current = currentRows[0];
    if (!current) {
      throw new DomainError(
        "patient_profile_not_found",
        403,
        "Perfil não encontrado.",
      );
    }

    const metadata = asObject(current.metadata);
    const account = asObject(metadata.account);
    const nextMetadata = {
      ...metadata,
      account: { ...account, address: payload.address },
    };

    const [profileRows] = await Promise.all([
      client.patch<Array<{ display_name: string; phone: string | null }>>(
        `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&limit=1`,
        {
          display_name: payload.name,
          phone: payload.phone || null,
          phone_country_code: payload.phoneCountryCode,
        },
        "return=representation",
      ),
      client.patch(
        `/rest/v1/patient_profiles?id=eq.${encodeURIComponent(profile.id)}&limit=1`,
        {
          display_name: payload.name,
          metadata: nextMetadata,
          phone: payload.phone || null,
          phone_country_code: payload.phoneCountryCode,
        },
        "return=minimal",
      ),
    ]);

    return success({
      address: payload.address,
      avatarUrl: current.avatar_url,
      email: "",
      id: user.id,
      name: profileRows?.[0]?.display_name ?? payload.name,
      phone: profileRows?.[0]?.phone ?? payload.phone,
      phoneCountryCode: payload.phoneCountryCode,
    });
  } catch (error) {
    return failure(error, requestId);
  }
});

type CommandBody = {
  action: string;
  payload?: unknown;
};

async function uploadAvatar({
  client,
  file,
  profileId,
  serviceRoleKey,
  supabaseUrl,
  userId,
}: {
  client: SupabaseRestClient;
  file: FormDataEntryValue | null;
  profileId: string;
  serviceRoleKey: string;
  supabaseUrl: string;
  userId: string;
}) {
  if (!(file instanceof File) || !isSupportedImageType(file.type)) {
    throw new DomainError(
      "invalid_file",
      422,
      "Escolha uma imagem em JPG, PNG ou WebP.",
    );
  }
  if (file.size > maxAvatarBytes) {
    throw new DomainError(
      "file_too_large",
      422,
      "A imagem deve ter no máximo 5 MB.",
    );
  }

  const objectPath = `${userId}/avatar-${crypto.randomUUID()}${extensionFor(file.type)}`;
  const uploadResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`,
    {
      body: file,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": file.type,
        "x-upsert": "false",
      },
      method: "POST",
    },
  );
  if (!uploadResponse.ok) {
    throw new DomainError(
      "avatar_upload_failed",
      502,
      "Não foi possível enviar a foto agora.",
    );
  }

  const avatarUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;
  await Promise.all([
    client.patch(
      `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&limit=1`,
      { avatar_url: avatarUrl },
      "return=minimal",
    ),
    client.patch(
      `/rest/v1/patient_profiles?id=eq.${encodeURIComponent(profileId)}&limit=1`,
      { avatar_url: avatarUrl },
      "return=minimal",
    ),
  ]);

  return { avatarUrl };
}

function parseProfilePayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DomainError(
      "invalid_payload",
      422,
      "Revise os dados antes de salvar.",
    );
  }
  const payload = value as Record<string, unknown>;
  if (typeof payload.name !== "string") {
    throw new DomainError("invalid_name", 422, "Informe seu nome completo.");
  }
  const name = payload.name.trim();
  if (name.length < 2 || name.length > 120) {
    throw new DomainError("invalid_name", 422, "Informe seu nome completo.");
  }
  const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
  if (phone.length > 30 || (phone && !/^[+()0-9\s-]+$/.test(phone))) {
    throw new DomainError("invalid_phone", 422, "Revise o telefone informado.");
  }
  const phoneCountryCode =
    typeof payload.phoneCountryCode === "string" &&
    /^[1-9]\d{0,2}$/.test(payload.phoneCountryCode)
      ? payload.phoneCountryCode
      : "55";
  const phoneDigits = phone.replace(/\D/g, "");
  if (
    phoneDigits &&
    (phoneDigits.length < 4 ||
      phoneDigits.length > 15 ||
      /^(\d)\1+$/.test(phoneDigits) ||
      (phoneCountryCode === "55" &&
        (phoneDigits.length < 10 || phoneDigits.length > 11)))
  ) {
    throw new DomainError("invalid_phone", 422, "Revise o telefone informado.");
  }

  return {
    address: parseAddress(payload.address),
    name,
    phone,
    phoneCountryCode,
  };
}

function parseAddress(value: unknown): Address {
  const record = asObject(value);
  const address = {
    city: text(record.city, 100),
    complement: text(record.complement, 100),
    neighborhood: text(record.neighborhood, 100),
    postalCode: text(record.postalCode, 9).replace(/\D/g, ""),
    state: text(record.state, 2).toUpperCase(),
    street: text(record.street, 160),
    streetNumber: text(record.streetNumber, 20),
  };
  if (address.postalCode && !/^\d{8}$/.test(address.postalCode)) {
    throw new DomainError(
      "invalid_postal_code",
      422,
      "Revise o CEP informado.",
    );
  }
  if (address.state && !/^[A-Z]{2}$/.test(address.state)) {
    throw new DomainError("invalid_state", 422, "Revise o estado informado.");
  }
  return address;
}

function isPasswordPayload(value: unknown): value is {
  confirmPassword: string;
  password: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.password === "string" &&
    payload.password.length >= 8 &&
    payload.password.length <= 128 &&
    typeof payload.confirmPassword === "string" &&
    payload.password === payload.confirmPassword
  );
}

function text(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isSupportedImageType(value: string) {
  return (
    value === "image/jpeg" || value === "image/png" || value === "image/webp"
  );
}

function extensionFor(value: string) {
  if (value === "image/jpeg") return ".jpg";
  if (value === "image/png") return ".png";
  return ".webp";
}
