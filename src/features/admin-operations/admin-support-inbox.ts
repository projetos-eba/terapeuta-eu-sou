import "server-only";

import {
  ADMIN_LIST_DEFAULT_PAGE_SIZE,
  ADMIN_LIST_MAX_PAGE_SIZE,
  type AdminListPageInfo,
} from "@/features/admin-shared/admin-list-query";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

export const adminSupportStatuses = [
  "open",
  "in_progress",
  "waiting_requester",
  "waiting_support",
  "resolved",
] as const;
export const adminSupportPriorities = [
  "low",
  "normal",
  "high",
  "urgent",
] as const;
export const adminSupportPersonas = ["patient", "therapist"] as const;
export const adminSupportAssignments = ["unassigned", "me"] as const;

export type AdminSupportInboxQuery = {
  assignment: "" | (typeof adminSupportAssignments)[number];
  category: string;
  page: number;
  pageSize: number;
  persona: "" | (typeof adminSupportPersonas)[number];
  priority: "" | (typeof adminSupportPriorities)[number];
  search: string;
  status: "" | (typeof adminSupportStatuses)[number];
};

export type AdminSupportInboxRow = {
  assignedAdminId: string | null;
  assignedAdminName: string | null;
  bookingId: string | null;
  category: string;
  createdAt: string;
  id: string;
  lastActivityAt: string;
  priority: string;
  requesterName: string | null;
  requesterRole: "patient" | "therapist" | null;
  status: string;
  subject: string;
};

export type AdminSupportInboxData = {
  attentionCount: number;
  categories: string[];
  page: AdminListPageInfo;
  query: AdminSupportInboxQuery;
  rows: AdminSupportInboxRow[];
};

type RawSearchParams = Record<string, string | string[] | undefined>;
type UnknownRecord = Record<string, unknown>;

export function parseAdminSupportInboxQuery(
  searchParams: RawSearchParams = {},
): AdminSupportInboxQuery {
  return {
    assignment: oneOf(first(searchParams.assignment), adminSupportAssignments),
    category: cleanToken(first(searchParams.category), 80),
    page: positiveInt(first(searchParams.page), 1, 10000),
    pageSize: positiveInt(
      first(searchParams.pageSize),
      ADMIN_LIST_DEFAULT_PAGE_SIZE,
      ADMIN_LIST_MAX_PAGE_SIZE,
    ),
    persona: oneOf(first(searchParams.persona), adminSupportPersonas),
    priority: oneOf(first(searchParams.priority), adminSupportPriorities),
    search: (first(searchParams.q) ?? "").trim().slice(0, 120),
    status: oneOf(first(searchParams.status), adminSupportStatuses),
  };
}

export function buildAdminSupportInboxHref(
  current: AdminSupportInboxQuery,
  patch: Partial<AdminSupportInboxQuery> = {},
) {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.search) params.set("q", next.search);
  if (next.status) params.set("status", next.status);
  if (next.priority) params.set("priority", next.priority);
  if (next.category) params.set("category", next.category);
  if (next.persona) params.set("persona", next.persona);
  if (next.assignment) params.set("assignment", next.assignment);
  if (next.page > 1) params.set("page", String(next.page));
  if (next.pageSize !== ADMIN_LIST_DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(next.pageSize));
  }
  const query = params.toString();
  return query ? `/admin/suporte?${query}` : "/admin/suporte";
}

export async function getAdminSupportInbox({
  accessToken,
  searchParams,
}: {
  accessToken: string;
  searchParams?: RawSearchParams;
}): Promise<
  | { data: AdminSupportInboxData; status: "success" }
  | { message: string; status: "error" }
> {
  const config = getSupabasePublicConfig();
  const query = parseAdminSupportInboxQuery(searchParams);
  if (!config) {
    return {
      message: "A central de suporte está indisponível agora.",
      status: "error",
    };
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/rpc/admin_get_support_inbox_v1`,
      {
        body: JSON.stringify({
          p_query: {
            assignment: query.assignment || undefined,
            category: query.category || undefined,
            page: query.page,
            pageSize: query.pageSize,
            persona: query.persona || undefined,
            priority: query.priority || undefined,
            search: query.search || undefined,
            status: query.status || undefined,
          },
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
    if (!response.ok) {
      return {
        message: "Não foi possível carregar os chamados agora.",
        status: "error",
      };
    }
    const model = await response.json().catch(() => null);
    if (!isRecord(model)) {
      return {
        message: "Não foi possível carregar os chamados agora.",
        status: "error",
      };
    }
    const rows = Array.isArray(model.rows)
      ? model.rows
          .filter(isRecord)
          .map(mapRow)
          .filter((row): row is AdminSupportInboxRow => row !== null)
      : [];
    const page = isRecord(model.page) ? model.page : {};
    const categories = [
      ...new Set(rows.map((row) => row.category).filter(Boolean)),
    ].sort();
    return {
      data: {
        attentionCount: nonNegative(model.attentionCount),
        categories,
        page: {
          hasNext: Boolean(page.hasNext),
          page: positive(page.page, query.page),
          pageSize: positive(page.pageSize, query.pageSize),
          total: nonNegative(page.total),
        },
        query,
        rows,
      },
      status: "success",
    };
  } catch {
    return {
      message: "Não foi possível carregar os chamados agora.",
      status: "error",
    };
  }
}

function mapRow(value: UnknownRecord): AdminSupportInboxRow | null {
  const id = text(value.id);
  const subject = text(value.subject);
  if (!id || !subject) return null;
  const role = text(value.requesterRole);
  return {
    assignedAdminId: nullableText(value.assignedAdminId),
    assignedAdminName: nullableText(value.assignedAdminName),
    bookingId: nullableText(value.bookingId),
    category: text(value.category),
    createdAt: text(value.createdAt),
    id,
    lastActivityAt: text(value.lastActivityAt),
    priority: text(value.priority),
    requesterName: nullableText(value.requesterName),
    requesterRole: role === "patient" || role === "therapist" ? role : null,
    status: text(value.status),
    subject,
  };
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
function oneOf<const T extends readonly string[]>(
  value: string | undefined,
  values: T,
): "" | T[number] {
  return typeof value === "string" && values.includes(value) ? value : "";
}
function cleanToken(value: string | undefined, max: number) {
  const token = (value ?? "").trim().slice(0, max);
  return /^[a-z0-9_.-]+$/i.test(token) ? token : "";
}
function positiveInt(value: string | undefined, fallback: number, max: number) {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(parsed, max)
    : fallback;
}
function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function text(value: unknown) {
  return typeof value === "string" ? value : "";
}
function nullableText(value: unknown) {
  const result = text(value);
  return result || null;
}
function positive(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}
function nonNegative(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}
