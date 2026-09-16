import "server-only";

import { cache } from "react";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import { formatMessageRelativeTime } from "./message-center-date-formatters";
import { getSupportTemplates } from "./message-center.templates";
import type {
  MessageCenterActorRole,
  MessageCenterPagination,
  MessageCenterPageData,
  MessageCenterPlatformItem,
} from "./message-center.types";

type SupabaseServerConfig = {
  accessToken: string;
  apiKey: string;
  url: string;
};

type MessageCenterInput = {
  accessToken: string | null;
  actorRole: MessageCenterActorRole;
  conversationPage?: number;
  profileId: string;
  supportPage?: number;
  therapistProfileId?: string;
};

type RawSearchParams = Record<string, string | string[] | undefined>;
const supportCenterPageSize = 10;

export type MessageCenterPageQuery = {
  conversationPage: number;
  supportPage: number;
};

type SupportTicketRow = {
  category: string;
  created_at: string;
  description: string | null;
  id: string;
  last_activity_at: string | null;
  protocol: string;
  resolution_summary: string | null;
  status: string;
  subject: string;
};

type SupportTicketMessageRow = {
  body: string;
  created_at: string;
  ticket_id: string;
};

type NotificationRow = {
  body: string | null;
  created_at: string;
  id: string;
  kind: string;
  read_at: string | null;
  title: string;
};

export class MessageCenterDataError extends Error {
  constructor() {
    super("Não foi possível carregar a Central de Suporte.");
  }
}

export const getMessageCenterPage = cache(async function getMessageCenterPage(
  input: MessageCenterInput,
): Promise<MessageCenterPageData> {
  const config = getSupabaseServerConfig(input.accessToken);

  if (!config) {
    if (
      process.env.NODE_ENV === "development" &&
      process.env.TES_SUPPORT_DEMO_ENABLED === "true"
    ) {
      return createDemoSupportCenter(input.actorRole, input.supportPage);
    }
    throw new MessageCenterDataError();
  }

  try {
    return await getSupabaseSupportCenter(config, input);
  } catch {
    if (
      process.env.NODE_ENV === "development" &&
      process.env.TES_SUPPORT_DEMO_ENABLED === "true"
    ) {
      return createDemoSupportCenter(input.actorRole, input.supportPage);
    }
    throw new MessageCenterDataError();
  }
});

async function getSupabaseSupportCenter(
  config: SupabaseServerConfig,
  input: MessageCenterInput,
): Promise<MessageCenterPageData> {
  const supportPage = normalizePage(input.supportPage);
  const [supportTickets, notifications, openSupportTicketsCount] =
    await Promise.all([
      supabasePage<SupportTicketRow>(
        config,
        `/rest/v1/support_tickets?select=id,protocol,category,subject,description,status,resolution_summary,created_at,last_activity_at&requester_profile_id=eq.${encodeURIComponent(input.profileId)}&order=last_activity_at.desc.nullslast,id.desc`,
        supportPage,
      ),
      supabaseRequest<NotificationRow[]>(
        config,
        `/rest/v1/notifications?select=id,kind,title,body,read_at,created_at&profile_id=eq.${encodeURIComponent(input.profileId)}&kind=neq.message_received&order=created_at.desc&limit=5`,
      ),
      supabaseCount(
        config,
        `/rest/v1/support_tickets?select=id&requester_profile_id=eq.${encodeURIComponent(input.profileId)}&status=neq.resolved`,
      ),
    ]);

  const supportMessages = supportTickets.rows.length
    ? await supabaseRequest<SupportTicketMessageRow[]>(
        config,
        `/rest/v1/support_ticket_messages?select=ticket_id,body,created_at&ticket_id=in.(${supportTickets.rows.map((ticket) => ticket.id).join(",")})&visibility=eq.requester&order=created_at.desc`,
      )
    : [];
  const latestMessageByTicket = new Map<string, SupportTicketMessageRow>();
  for (const message of supportMessages) {
    if (!latestMessageByTicket.has(message.ticket_id)) {
      latestMessageByTicket.set(message.ticket_id, message);
    }
  }

  return {
    ...createSupportCenterShell(input.actorRole),
    metrics: { openSupportTicketsCount, unreadMessagesCount: 0 },
    participantPagination: paginationFor(0, 1),
    platformItems: mapPlatformItems(notifications),
    source: "supabase",
    supportPagination: supportTickets.pagination,
    supportTickets: supportTickets.rows.map((ticket) => ({
      category: ticket.category,
      createdAt: ticket.created_at,
      excerpt:
        latestMessageByTicket.get(ticket.id)?.body ??
        ticket.resolution_summary ??
        ticket.description ??
        "A equipe TES está acompanhando este chamado.",
      id: ticket.id,
      lastActivityAt: ticket.last_activity_at ?? ticket.created_at,
      protocol: ticket.protocol,
      status: ticket.status,
      subject: ticket.subject,
    })),
    threads: [],
  };
}

function mapPlatformItems(
  notifications: NotificationRow[],
): MessageCenterPlatformItem[] {
  return notifications.map((notification) => ({
    body: notification.body ?? "Atualização da plataforma.",
    category: notification.kind === "payment" ? "financeiro" : "plataforma",
    categoryLabel:
      notification.kind === "payment" ? "Financeiro" : "Plataforma",
    id: notification.id,
    isNotification: true,
    isUnread: notification.read_at === null,
    timeLabel: formatMessageRelativeTime(notification.created_at),
    title: notification.title,
  }));
}

export function parseMessageCenterPageQuery(
  searchParams: RawSearchParams = {},
): MessageCenterPageQuery {
  return {
    conversationPage: 1,
    supportPage: normalizePage(firstSearchParam(searchParams.supportPage)),
  };
}

function createSupportCenterShell(
  actorRole: MessageCenterActorRole,
): Omit<
  MessageCenterPageData,
  | "metrics"
  | "participantPagination"
  | "platformItems"
  | "source"
  | "supportPagination"
  | "supportTickets"
  | "threads"
> {
  return {
    actorRole,
    hero: {
      description:
        "Converse com a equipe TES e acompanhe chamados e avisos da plataforma em um só lugar.",
      title: "Suporte TES",
    },
    participantSection: { description: "", title: "" },
    platformSection: {
      description: "Atualizações da plataforma sobre sua conta e suas sessões.",
      title: "Avisos TES",
    },
    templates: {
      participant: [],
      support: getSupportTemplates(actorRole),
    },
  };
}

function createDemoSupportCenter(
  actorRole: MessageCenterActorRole,
  supportPageValue?: number,
): MessageCenterPageData {
  return {
    ...createSupportCenterShell(actorRole),
    metrics: { openSupportTicketsCount: 0, unreadMessagesCount: 0 },
    participantPagination: paginationFor(0, 1),
    platformItems: [],
    source: "demo",
    supportPagination: paginationFor(0, normalizePage(supportPageValue)),
    supportTickets: [],
    threads: [],
  };
}

function getSupabaseServerConfig(
  accessToken: string | null,
): SupabaseServerConfig | null {
  const config = getSupabasePublicConfig();
  if (!config || !accessToken) return null;
  return { accessToken, apiKey: config.apiKey, url: config.url };
}

async function supabaseRequest<T>(
  config: SupabaseServerConfig,
  path: string,
): Promise<T> {
  const response = await fetch(`${config.url}${path}`, {
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) throw new MessageCenterDataError();
  return (await response.json()) as T;
}

async function supabaseCount(config: SupabaseServerConfig, path: string) {
  const response = await fetch(`${config.url}${path}`, {
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.accessToken}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
    method: "HEAD",
  });
  if (!response.ok) throw new MessageCenterDataError();
  const count = Number((response.headers.get("content-range") ?? "").split("/").at(-1));
  return Number.isFinite(count) ? count : 0;
}

async function supabasePage<T>(
  config: SupabaseServerConfig,
  path: string,
  page: number,
): Promise<{ pagination: MessageCenterPagination; rows: T[] }> {
  const start = (page - 1) * supportCenterPageSize;
  const response = await fetch(`${config.url}${path}`, {
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.accessToken}`,
      Prefer: "count=exact",
      Range: `${start}-${start + supportCenterPageSize - 1}`,
    },
  });
  if (!response.ok) throw new MessageCenterDataError();
  const rows = (await response.json()) as T[];
  const total = Number((response.headers.get("content-range") ?? "").split("/").at(-1));
  return {
    pagination: paginationFor(Number.isFinite(total) ? total : rows.length, page),
    rows,
  };
}

function paginationFor(total: number, page: number): MessageCenterPagination {
  return {
    hasNext: page * supportCenterPageSize < total,
    page,
    pageSize: supportCenterPageSize,
    total,
  };
}

function normalizePage(value: number | string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
