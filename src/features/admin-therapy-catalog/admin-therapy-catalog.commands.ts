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
