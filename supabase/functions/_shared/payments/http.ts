import { jsonResponse } from "../auth/cors.ts";
import { SupabaseRestClient } from "../auth/supabase-rest.ts";

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
};

export class DomainError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
    message = "A solicitacao nao pode ser concluida.",
  ) {
    super(message);
  }
}

export function success<T>(data: T, status = 200) {
  return jsonResponse({ ok: true, data } satisfies ApiSuccess<T>, status);
}

export function failure(error: unknown, requestId = crypto.randomUUID()) {
  if (error instanceof DomainError) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          requestId,
        },
      } satisfies ApiFailure,
      error.status,
    );
  }

  console.error(
    JSON.stringify({
      code: "PAYMENTS_UNHANDLED_ERROR",
      message: error instanceof Error ? error.message : "UNKNOWN",
      request_id: requestId,
    }),
  );

  return jsonResponse(
    {
      ok: false,
      error: {
        code: "internal_error",
        message: "Nao conseguimos concluir a operacao agora.",
        requestId,
      },
    } satisfies ApiFailure,
    500,
  );
}

export async function parseJsonBody<T>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    throw new DomainError("invalid_json", 400, "Envie um JSON valido.");
  }
}

export type AuthenticatedUser = {
  id: string;
  role: "admin" | "patient" | "therapist";
};

export async function requireUser(
  client: SupabaseRestClient,
  request: Request,
): Promise<AuthenticatedUser> {
  const token = getBearerToken(request);

  if (!token) {
    throw new DomainError(
      "unauthorized",
      401,
      "Entre na sua conta para continuar.",
    );
  }

  const userResponse = await fetch(`${client.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: client.serviceRoleKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!userResponse.ok) {
    throw new DomainError(
      "unauthorized",
      401,
      "Entre na sua conta para continuar.",
    );
  }

  const user = (await userResponse.json()) as { id?: string };

  if (!user.id) {
    throw new DomainError(
      "unauthorized",
      401,
      "Entre na sua conta para continuar.",
    );
  }

  const profiles = await client.get<
    Array<{ id: string; role: AuthenticatedUser["role"] }>
  >(
    `/rest/v1/profiles?select=id,role&id=eq.${encodeURIComponent(user.id)}&limit=1`,
  );

  if (!profiles[0]) {
    throw new DomainError("profile_not_found", 403, "Perfil nao encontrado.");
  }

  return profiles[0];
}

export async function requireTherapist(
  client: SupabaseRestClient,
  request: Request,
  options: {
    allowBlockedStatus?: boolean;
    requireReceivingAccount?: boolean;
  } = {},
) {
  const user = await requireUser(client, request);

  if (user.role !== "therapist") {
    throw new DomainError("role_mismatch", 403, "Use o acesso de terapeuta.");
  }

  const rows = await client.get<
    Array<{
      id: string;
      plan: "free" | "premium" | "premium_plus";
      public_name: string;
      status:
        | "approved"
        | "draft"
        | "rejected"
        | "submitted"
        | "suspended"
        | "under_review";
      user_id: string;
    }>
  >(
    `/rest/v1/therapist_profiles?select=id,user_id,plan,public_name,status&user_id=eq.${encodeURIComponent(
      user.id,
    )}&limit=1`,
  );

  if (!rows[0]) {
    throw new DomainError(
      "therapist_profile_not_found",
      403,
      "Perfil de terapeuta nao encontrado.",
    );
  }

  if (
    !options.allowBlockedStatus &&
    (rows[0].status === "suspended" || rows[0].status === "rejected")
  ) {
    throw new DomainError(
      "therapist_financial_access_blocked",
      403,
      "As operacoes financeiras deste perfil estao bloqueadas.",
    );
  }

  if (options.requireReceivingAccount) {
    const accounts = await client.get<
      Array<{
        details_submitted: boolean;
        onboarding_status: string;
        pending_requirements: unknown;
        stripe_transfers_status: string;
      }>
    >(
      `/rest/v1/therapist_connect_accounts?select=details_submitted,onboarding_status,pending_requirements,stripe_transfers_status&therapist_profile_id=eq.${encodeURIComponent(
        rows[0].id,
      )}&limit=1`,
    );
    const account = accounts[0];
    if (!isTherapistReceivingAccountReady(account)) {
      throw new DomainError(
        "therapist_receiving_account_required",
        403,
        "Conclua o cadastro da conta de recebimento antes de iniciar o atendimento.",
      );
    }
  }

  return { profile: rows[0], user };
}

export function isTherapistReceivingAccountReady(
  account: {
    details_submitted: boolean;
    onboarding_status: string;
    pending_requirements: unknown;
    stripe_transfers_status: string;
  } | null | undefined,
) {
  const pendingRequirements = account?.pending_requirements;
  const currentlyDue =
    pendingRequirements &&
    typeof pendingRequirements === "object" &&
    !Array.isArray(pendingRequirements)
      ? getRequirementList(pendingRequirements, "currentlyDue")
      : Array.isArray(pendingRequirements)
        ? pendingRequirements
        : [];
  const blockedStatuses = new Set([
    "requirements_due",
    "restricted",
    "disabled",
  ]);

  return Boolean(account?.details_submitted) &&
    currentlyDue.length === 0 &&
    !blockedStatuses.has(account?.onboarding_status ?? "") &&
    (account?.onboarding_status !== "ready" ||
      account.stripe_transfers_status === "active");
}

function getRequirementList(value: object, key: "currentlyDue") {
  const record = value as Record<string, unknown>;
  const candidate = record[key] ?? record.currently_due;
  return Array.isArray(candidate) ? candidate : [];
}

export async function requirePatient(
  client: SupabaseRestClient,
  request: Request,
) {
  const user = await requireUser(client, request);

  if (user.role !== "patient") {
    throw new DomainError("role_mismatch", 403, "Use o acesso de cliente.");
  }

  const rows = await client.get<
    Array<{ id: string; display_name: string; user_id: string }>
  >(
    `/rest/v1/patient_profiles?select=id,user_id,display_name&user_id=eq.${encodeURIComponent(
      user.id,
    )}&limit=1`,
  );

  if (!rows[0]) {
    throw new DomainError(
      "patient_profile_not_found",
      403,
      "Perfil de cliente nao encontrado.",
    );
  }

  return { profile: rows[0], user };
}

export async function requireInternalOperationsAccess(
  expectedToken: string | null | undefined,
  request: Request,
) {
  const actualToken = request.headers.get("x-tes-internal-operations-token");

  if (!expectedToken || !actualToken) {
    throw new DomainError(
      "operations_token_required",
      401,
      "Acesso operacional necessario.",
    );
  }

  if (!(await secureTokenEquals(expectedToken, actualToken))) {
    throw new DomainError(
      "operations_token_required",
      401,
      "Acesso operacional necessario.",
    );
  }
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(/\s+/);

  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

async function secureTokenEquals(expected: string, actual: string) {
  const encoder = new TextEncoder();
  const [expectedHash, actualHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
  ]);
  const expectedBytes = new Uint8Array(expectedHash);
  const actualBytes = new Uint8Array(actualHash);

  if (expectedBytes.length !== actualBytes.length) return false;

  let diff = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    diff |= expectedBytes[index] ^ actualBytes[index];
  }

  return diff === 0;
}
