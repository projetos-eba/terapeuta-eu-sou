import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  canUseAdminPermission,
  type AdminPermission,
} from "@/lib/auth/admin-permissions";
import { readAdminSessionFromAccessToken } from "@/lib/auth/admin-session";
import { routes } from "@/lib/routes";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const actionPermissions = {
  "professional.reactivate": "admin.professionals.suspend",
  "professional.suspend": "admin.professionals.suspend",
  "review.hide": "admin.reviews.moderate",
  "review.restore": "admin.reviews.moderate",
  "support.reopen": "admin.support.manage",
  "support.resolve": "admin.support.manage",
  "verification.approve": "admin.professionals.verify",
  "verification.reject": "admin.professionals.verify",
  "verification.request_changes": "admin.professionals.verify",
} satisfies Record<string, AdminPermission>;

type AdminOperationCommandAction = keyof typeof actionPermissions;

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return failure("Envie os dados em formato valido.", 400);
  }

  const input = parseCommandInput(body);

  if (!input.ok) {
    return failure(input.message, input.status);
  }

  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_admin_access_token")?.value;

  if (!config || !accessToken) {
    return failure("Entre com uma conta administrativa para continuar.", 401);
  }

  const session = await readAdminApiSession(config, accessToken);

  if (
    !session ||
    !canUseAdminPermission(session.permissions, input.value.permission)
  ) {
    return failure("Acesso administrativo necessário.", 403);
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/rpc/admin_execute_operation_command_v1`,
      {
        body: JSON.stringify({
          p_action: input.value.action,
          p_correlation_id: input.value.correlationId,
          p_entity_id: input.value.entityId,
          p_payload: input.value.payload,
          p_reason: input.value.reason,
          p_request_id: input.value.requestId,
        }),
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      return failure(mapRpcFailure(payload), response.status);
    }

    revalidateAdminOperationSurfaces(input.value.action);

    return NextResponse.json(
      { data: payload, ok: true },
      { headers: noStoreHeaders, status: 200 },
    );
  } catch {
    return failure("Não foi possível executar a ação agora.", 503);
  }
}

async function readAdminApiSession(
  config: { apiKey: string; url: string },
  accessToken: string,
) {
  try {
    return await readAdminSessionFromAccessToken(config, accessToken);
  } catch {
    return null;
  }
}

function parseCommandInput(value: unknown):
  | {
      ok: true;
      value: {
        action: AdminOperationCommandAction;
        correlationId: string | null;
        entityId: string;
        payload: Record<string, unknown>;
        permission: AdminPermission;
        reason: string;
        requestId: string;
      };
    }
  | { message: string; ok: false; status: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { message: "Envie os dados em formato valido.", ok: false, status: 400 };
  }

  const record = value as Record<string, unknown>;
  const action = asString(record.action);
  const entityId = asString(record.entityId);
  const reason = asString(record.reason).trim();
  const requestId = asString(record.requestId).trim();
  const correlationId = asString(record.correlationId).trim() || null;
  if (!isAdminOperationCommandAction(action)) {
    return { message: "Ação administrativa não suportada.", ok: false, status: 422 };
  }

  const permission = actionPermissions[action];


  if (!UUID_PATTERN.test(entityId)) {
    return { message: "Registro administrativo inválido.", ok: false, status: 422 };
  }

  if (reason.length < 8 || reason.length > 1000) {
    return {
      message: "Informe um motivo com pelo menos 8 caracteres.",
      ok: false,
      status: 422,
    };
  }

  if (requestId.length < 8 || requestId.length > 128) {
    return {
      message: "Identificador da ação inválido.",
      ok: false,
      status: 422,
    };
  }

  return {
    ok: true,
    value: {
      action,
      correlationId,
      entityId,
      payload: isRecord(record.payload) ? record.payload : {},
      permission,
      reason,
      requestId,
    },
  };
}

function mapRpcFailure(payload: unknown) {
  if (isRecord(payload) && typeof payload.message === "string") {
    if (payload.message.includes("reason")) {
      return "Informe um motivo válido para executar a ação.";
    }

    if (payload.message.includes("permission")) {
      return "Acesso administrativo necessário.";
    }

    if (payload.message.includes("target not found")) {
      return "Registro administrativo não encontrado.";
    }
  }

  return "Não foi possível executar a ação agora.";
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}

function revalidateAdminOperationSurfaces(action: string) {
  revalidatePath(routes.admin.home);
  revalidatePath(routes.admin.professionals);
  revalidatePath(routes.admin.verifications);
  revalidatePath(routes.admin.support);
  revalidatePath(routes.admin.reviews);

  if (action.startsWith("professional.") || action.startsWith("verification.")) {
    revalidateTag("therapist-profile");
    revalidateTag("therapist-search");
    revalidatePath("/terapeutas");
    revalidatePath("/terapeutas/[slug]", "page");
  }

  if (action.startsWith("review.")) {
    revalidateTag("therapist-profile");
    revalidatePath("/terapeutas/[slug]", "page");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isAdminOperationCommandAction(
  value: string,
): value is AdminOperationCommandAction {
  return Object.hasOwn(actionPermissions, value);
}
