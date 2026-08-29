"use client";

import { parseAdminTherapyCatalogContract } from "./admin-therapy-catalog.parsers";
import type {
  AdminTherapyCatalogContract,
  AdminTherapyCatalogRequestDetail,
  AdminTherapyDraftCommand,
  AdminTherapyTransition,
} from "./admin-therapy-catalog.types";

type AdminCommand =
  | { action: "list" }
  | {
      action: "save";
      payload: AdminTherapyDraftCommand;
      requestId: string;
    }
  | {
      action: "transition";
      payload?: Record<string, unknown>;
      reason: string;
      requestId: string;
      therapyId: string;
      transition: AdminTherapyTransition;
    }
  | {
      action: "decideRequest";
      catalogRequestId: string;
      decision: string;
      relatedTherapyId?: string | null;
      requestId: string;
      status: string;
    };

type ApiEnvelope =
  | { data: unknown; ok: true }
  | {
      error?: {
        code?: string;
        message?: string;
        requestId?: string;
      };
      ok: false;
    };

export type AdminTherapyCatalogCommandResult =
  | {
      catalog: AdminTherapyCatalogContract;
      status: "success";
    }
  | {
      error: {
        code: string;
        message: string;
        requestId?: string;
      };
      status: "error";
    };

const userMessages: Record<string, string> = {
  admin_required: "Você não tem permissão para realizar esta ação.",
  archive_blocked_by_usage:
    "Esta terapia possui serviços ativos ou sessões futuras. Descontinue-a antes de arquivar.",
  catalog_command_failed:
    "Não foi possível salvar a terapia. Verifique a categoria, os temas do Match e os campos obrigatórios e tente novamente.",
  incomplete_public_content:
    "Complete o conteúdo público, incluindo imagem e pelo menos um destaque e dois benefícios, antes de publicar.",
  inactive_category: "Escolha uma categoria ativa antes de publicar.",
  invalid_payload: "Revise os campos obrigatórios da terapia e tente novamente.",
  invalid_theme: "Selecione apenas temas ativos do Match.",
  matching_theme_removal_blocked:
    "Não é possível remover este tema porque ele está em uso por serviços ou refinamentos.",
  network_error: "Não foi possível conectar agora. Tente novamente.",
  not_found: "A terapia não foi encontrada. Atualize a página e tente novamente.",
  reason_required: "Informe o motivo desta alteração.",
  safe_copy: "Revise o conteúdo para remover promessas de cura, diagnóstico ou resultado garantido.",
  slug_conflict: "Este endereço já está em uso no catálogo.",
  theme_limit: "Selecione de 1 a 3 temas do Match.",
  theme_required: "Selecione pelo menos um tema do Match.",
  unsafe_copy:
    "Revise o conteúdo para remover promessas de cura, diagnóstico ou resultado garantido.",
  short_description_too_long: "O resumo deve ter no máximo 100 caracteres.",
  description_too_long: "A abordagem deve ter no máximo 200 caracteres.",
  introduction_too_long: "O campo O que é deve ter no máximo 160 caracteres.",
  complementary_description_too_long:
    "A descrição complementar deve ter no máximo 200 caracteres.",
  safety_note_too_long: "A nota responsável deve ter no máximo 150 caracteres.",
  benefit_description_too_long:
    "A descrição opcional do benefício deve ter no máximo 100 caracteres.",
};

export function getAdminTherapyCatalogUserMessage(error: {
  code: string;
  message: string;
}) {
  return userMessages[error.code] ?? userMessages.catalog_command_failed;
}

export async function sendAdminTherapyCatalogCommand(
  command: AdminCommand,
): Promise<AdminTherapyCatalogCommandResult> {
  try {
    const response = await fetch("/api/admin/therapies", {
      body: JSON.stringify(command),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as ApiEnvelope;

    if (!response.ok || !payload?.ok) {
      return {
        error: {
          code:
            payload && !payload.ok ? (payload.error?.code ?? "error") : "error",
          message:
            payload && !payload.ok
              ? (payload.error?.message ?? "Não foi possível atualizar.")
              : "Não foi possível atualizar.",
          requestId:
            payload && !payload.ok ? payload.error?.requestId : undefined,
        },
        status: "error",
      };
    }

    return {
      catalog: parseAdminTherapyCatalogContract(extractCatalog(payload.data)),
      status: "success",
    };
  } catch {
    return {
      error: {
        code: "network_error",
        message: "Não foi possível conectar agora. Tente novamente.",
      },
      status: "error",
    };
  }
}

export function createStableRequestId() {
  return crypto.randomUUID();
}

export async function fetchAdminTherapyCatalogRequests(): Promise<
  AdminTherapyCatalogRequestDetail[]
> {
  const result = await sendReadCommand({ action: "requestList" });
  if (!result.ok || !Array.isArray(result.data?.requests)) return [];
  return result.data.requests.flatMap(parseRequestDetail);
}

export async function getAdminCatalogRequestMaterialUrl(materialId: string) {
  const result = await sendReadCommand({ action: "requestSign", materialId });
  return result.ok && typeof result.data?.url === "string" ? result.data.url : null;
}

async function sendReadCommand(command: { action: "requestList" } | { action: "requestSign"; materialId: string }) {
  try {
    const response = await fetch("/api/admin/therapies", {
      body: JSON.stringify(command),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as ApiEnvelope;
    return payload?.ok
      ? { data: payload.data as Record<string, unknown>, ok: true as const }
      : { data: null, ok: false as const };
  } catch {
    return { data: null, ok: false as const };
  }
}

function parseRequestDetail(value: unknown): AdminTherapyCatalogRequestDetail[] {
  if (!isRecord(value)) return [];
  const status = typeof value.status === "string" ? value.status : "";
  if (![
    "approved", "merged", "needs_information", "rejected", "submitted", "under_review",
  ].includes(status)) return [];
  return [{
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
    decision: typeof value.decision === "string" ? value.decision : null,
    description: typeof value.description === "string" ? value.description : null,
    id: typeof value.id === "string" ? value.id : "",
    informedName: typeof value.informedName === "string" ? value.informedName : "",
    justification: typeof value.justification === "string" ? value.justification : null,
    materials: Array.isArray(value.materials) ? value.materials.flatMap(parseMaterial) : [],
    relatedTherapyId: typeof value.relatedTherapyId === "string" ? value.relatedTherapyId : null,
    status: status as AdminTherapyCatalogRequestDetail["status"],
    submission: isRecord(value.submission) ? value.submission : {},
    suggestedCategoryId: typeof value.suggestedCategoryId === "string" ? value.suggestedCategoryId : null,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
  }];
}

function parseMaterial(value: unknown) {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.fileName !== "string") return [];
  return [{
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
    fileName: value.fileName,
    fileSizeBytes: typeof value.fileSizeBytes === "number" ? value.fileSizeBytes : 0,
    id: value.id,
    mimeType: typeof value.mimeType === "string" ? value.mimeType : "",
  }];
}

function extractCatalog(data: unknown) {
  if (isRecord(data) && isRecord(data.catalog)) return data.catalog;
  return data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
