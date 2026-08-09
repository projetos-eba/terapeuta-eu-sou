export type AdminListQuery = {
  page: number;
  pageSize: number;
  search: string;
  sort: string;
  status: string;
};

export type AdminListPageInfo = {
  hasNext: boolean;
  page: number;
  pageSize: number;
  total: number;
};

export type AdminListOption = {
  label: string;
  value: string;
};

type RawSearchParams = Record<string, string | string[] | undefined>;

export const ADMIN_LIST_DEFAULT_PAGE_SIZE = 12;
export const ADMIN_LIST_MAX_PAGE_SIZE = 50;

export function parseAdminListQuery(
  searchParams: RawSearchParams = {},
): AdminListQuery {
  return {
    page: parsePositiveInt(firstValue(searchParams.page), 1),
    pageSize: Math.min(
      parsePositiveInt(
        firstValue(searchParams.pageSize),
        ADMIN_LIST_DEFAULT_PAGE_SIZE,
      ),
      ADMIN_LIST_MAX_PAGE_SIZE,
    ),
    search: cleanText(firstValue(searchParams.q)),
    sort: cleanToken(firstValue(searchParams.sort)),
    status: cleanToken(firstValue(searchParams.status)),
  };
}

export function toAdminListRpcQuery(query: AdminListQuery) {
  return {
    page: query.page,
    pageSize: query.pageSize,
    search: query.search || undefined,
    sort: query.sort || undefined,
    status: query.status || undefined,
  };
}

export function buildAdminListHref(
  baseHref: string,
  current: AdminListQuery,
  patch: Partial<AdminListQuery>,
) {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();

  if (next.search) params.set("q", next.search);
  if (next.status) params.set("status", next.status);
  if (next.sort) params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  if (next.pageSize !== ADMIN_LIST_DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(next.pageSize));
  }

  const query = params.toString();

  return query ? `${baseHref}?${query}` : baseHref;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanText(value: string | undefined) {
  return (value ?? "").trim().slice(0, 120);
}

function cleanToken(value: string | undefined) {
  const token = (value ?? "").trim().slice(0, 64);

  return /^[a-z0-9_.-]+$/i.test(token) ? token : "";
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value || !/^\d+$/.test(value)) return fallback;

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
