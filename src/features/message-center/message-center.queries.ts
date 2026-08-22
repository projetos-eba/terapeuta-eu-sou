import "server-only";

import { cache } from "react";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";
import { getTherapistAvatarUrl } from "@/lib/therapist-avatars";

import {
  getParticipantTemplates,
  getSupportTemplates,
} from "./message-center.templates";
import type {
  MessageCenterActorRole,
  MessageCenterCategory,
  MessageCenterPageData,
  MessageCenterPlatformItem,
  MessageCenterThread,
} from "./message-center.types";

type SupabaseServerConfig = {
  accessToken: string;
  apiKey: string;
  url: string;
};

type MessageCenterInput = {
  accessToken: string | null;
  actorRole: MessageCenterActorRole;
  profileId: string;
  therapistProfileId?: string;
};

type PatientProfileRow = {
  avatar_url: string | null;
  display_name: string;
  id: string;
  user_id: string;
};

type TherapistProfileRow = {
  id: string;
  photo_url: string | null;
  public_name: string;
};

type ConversationRow = {
  id: string;
  last_message_at: string | null;
  booking_id: string | null;
  patient_profile_id: string;
  therapist_profile_id: string;
};

type MessageRow = {
  body: string;
  conversation_id: string;
  created_at: string;
  id: string;
  read_at: string | null;
  sender_profile_id: string;
  metadata: unknown;
};

type BookingRow = {
  ends_at: string;
  id: string;
  starts_at: string;
  status: string;
};

type SupportTicketRow = {
  category: string;
  created_at: string;
  description: string | null;
  id: string;
  last_activity_at: string | null;
  resolution_summary: string | null;
  status: string;
  subject: string;
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
    super("Não foi possível carregar a central de mensagens.");
  }
}

export const getMessageCenterPage = cache(async function getMessageCenterPage(
  input: MessageCenterInput,
): Promise<MessageCenterPageData> {
  const config = getSupabaseServerConfig(input.accessToken);

  if (!config) {
    if (process.env.NODE_ENV === "development") {
      return createDemoMessageCenter(input.actorRole);
    }

    throw new MessageCenterDataError();
  }

  try {
    return await getSupabaseMessageCenter(config, input);
  } catch {
    if (process.env.NODE_ENV === "development") {
      return createDemoMessageCenter(input.actorRole);
    }

    throw new MessageCenterDataError();
  }
});

async function getSupabaseMessageCenter(
  config: SupabaseServerConfig,
  input: MessageCenterInput,
): Promise<MessageCenterPageData> {
  const participantProfileId =
    input.actorRole === "patient"
      ? await getPatientProfileId(config, input.profileId)
      : input.therapistProfileId;

  if (!participantProfileId) throw new MessageCenterDataError();

  const conversations = await supabaseRequest<ConversationRow[]>(
    config,
    `/rest/v1/conversations?select=id,patient_profile_id,therapist_profile_id,booking_id,last_message_at&${input.actorRole === "patient" ? "patient_profile_id" : "therapist_profile_id"}=eq.${encodeURIComponent(participantProfileId)}&order=last_message_at.desc.nullslast&limit=8`,
  );
  const conversationIds = conversations.map((conversation) => conversation.id);
  const [messages, supportTickets, notifications, bookings] = await Promise.all(
    [
      conversationIds.length > 0
        ? supabaseRequest<MessageRow[]>(
            config,
            `/rest/v1/messages?select=id,conversation_id,sender_profile_id,body,metadata,read_at,created_at&conversation_id=in.(${conversationIds.join(",")})&order=created_at.desc`,
          )
        : Promise.resolve([]),
      supabaseRequest<SupportTicketRow[]>(
        config,
        `/rest/v1/support_tickets?select=id,category,subject,description,status,resolution_summary,created_at,last_activity_at&requester_profile_id=eq.${encodeURIComponent(input.profileId)}&order=last_activity_at.desc.nullslast&limit=8`,
      ),
      supabaseRequest<NotificationRow[]>(
        config,
        `/rest/v1/notifications?select=id,kind,title,body,read_at,created_at&profile_id=eq.${encodeURIComponent(input.profileId)}&order=created_at.desc&limit=4`,
      ),
      conversations.some((conversation) => conversation.booking_id)
        ? supabaseRequest<BookingRow[]>(
            config,
            `/rest/v1/bookings?select=id,starts_at,ends_at,status&id=in.(${[...new Set(conversations.map((conversation) => conversation.booking_id).filter(Boolean))].join(",")})`,
          )
        : Promise.resolve([]),
    ],
  );
  const threads = await mapThreads({
    actorRole: input.actorRole,
    config,
    conversations,
    messages,
    bookings,
  });
  const platformItems = mapPlatformItems(supportTickets, notifications);
  const unreadCount =
    messages.filter(
      (message) =>
        message.read_at === null &&
        message.sender_profile_id !== input.profileId,
    ).length +
    notifications.filter((notification) => notification.read_at === null)
      .length;

  return {
    ...createMessageCenterShell(input.actorRole),
    metrics: {
      awaitingCount:
        threads.filter((thread) => thread.isUnread).length +
        supportTickets.filter((ticket) => ticket.status !== "resolved").length,
      unreadCount,
    },
    platformItems,
    supportTickets: supportTickets.map((ticket) => ({
      category: ticket.category,
      createdAt: ticket.created_at,
      id: ticket.id,
      lastActivityAt: ticket.last_activity_at ?? ticket.created_at,
      status: ticket.status,
      subject: ticket.subject,
    })),
    source: "supabase",
    threads,
  };
}

async function getPatientProfileId(
  config: SupabaseServerConfig,
  profileId: string,
) {
  const rows = await supabaseRequest<Array<{ id: string }>>(
    config,
    `/rest/v1/patient_profiles?select=id&user_id=eq.${encodeURIComponent(profileId)}&limit=1`,
  );

  return rows[0]?.id ?? null;
}

async function mapThreads(input: {
  actorRole: MessageCenterActorRole;
  config: SupabaseServerConfig;
  conversations: ConversationRow[];
  messages: MessageRow[];
  bookings: BookingRow[];
}): Promise<MessageCenterThread[]> {
  const latestByConversation = new Map<string, MessageRow>();
  for (const message of input.messages) {
    if (!latestByConversation.has(message.conversation_id)) {
      latestByConversation.set(message.conversation_id, message);
    }
  }

  if (input.conversations.length === 0) return [];

  if (input.actorRole === "patient") {
    const therapists = await getRowsByIds<TherapistProfileRow>(
      input.config,
      "therapist_profiles",
      "id,public_name,photo_url",
      input.conversations.map(
        (conversation) => conversation.therapist_profile_id,
      ),
    );
    const therapistById = new Map(
      therapists.map((therapist) => [therapist.id, therapist]),
    );

    return input.conversations.map((conversation) => {
      const message = latestByConversation.get(conversation.id);
      const therapist = therapistById.get(conversation.therapist_profile_id);

      return toThread({
        avatarUrl: getTherapistAvatarUrl(therapist?.photo_url ?? null, {
          name: therapist?.public_name ?? "Terapeuta",
        }),
        conversation,
        bookings: input.bookings,
        message,
        name: therapist?.public_name ?? "Terapeuta",
      });
    });
  }

  const patients = await getRowsByIds<PatientProfileRow>(
    input.config,
    "patient_profiles",
    "id,user_id,display_name,avatar_url",
    input.conversations.map((conversation) => conversation.patient_profile_id),
  );
  const patientById = new Map(patients.map((patient) => [patient.id, patient]));

  return input.conversations.map((conversation) => {
    const message = latestByConversation.get(conversation.id);
    const patient = patientById.get(conversation.patient_profile_id);

    return toThread({
      avatarUrl: patient?.avatar_url ?? null,
      conversation,
      bookings: input.bookings,
      message,
      name: patient?.display_name ?? "Cliente",
    });
  });
}

function toThread(input: {
  avatarUrl: string | null;
  conversation: ConversationRow;
  bookings: BookingRow[];
  message: MessageRow | undefined;
  name: string;
}): MessageCenterThread {
  const category = inferCategory(input.message?.body ?? "");
  const booking = input.bookings.find(
    (item) => item.id === input.conversation.booking_id,
  );
  const metadata = isRecord(input.message?.metadata)
    ? input.message?.metadata
    : null;
  const cta =
    isRecord(metadata?.cta) &&
    typeof metadata.cta.href === "string" &&
    isCanonicalParticipantHref(metadata.cta.href) &&
    isCtaAction(metadata.cta.action)
      ? {
          action: metadata.cta.action,
          href: metadata.cta.href,
          label:
            typeof metadata.cta.label === "string"
              ? metadata.cta.label
              : "Abrir sessão",
        }
      : null;

  return {
    avatarUrl: input.avatarUrl,
    body: input.message?.body ?? "Sem atualização recente.",
    bookingId: input.conversation.booking_id,
    category,
    categoryLabel: getCategoryLabel(category),
    conversationId: input.conversation.id,
    id: input.conversation.id,
    isUnread: input.message?.read_at === null,
    name: input.name,
    timeLabel: formatRelativeTime(
      input.message?.created_at ?? input.conversation.last_message_at,
    ),
    title: getThreadTitle(category),
    cta,
    sessionContext: booking
      ? `Sobre a sessão de ${formatSessionDate(booking.starts_at)}`
      : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCtaAction(
  value: unknown,
): value is NonNullable<MessageCenterThread["cta"]>["action"] {
  return (
    value === "view_session" ||
    value === "open_session" ||
    value === "reschedule_session" ||
    value === "cancel_session"
  );
}

function isCanonicalParticipantHref(value: string) {
  return /^\/(?:app\/encontros|terapeuta\/sessoes)\/[0-9a-f-]{36}$/i.test(
    value,
  );
}

function formatSessionDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function mapPlatformItems(
  tickets: SupportTicketRow[],
  notifications: NotificationRow[],
): MessageCenterPlatformItem[] {
  const ticketItems = tickets.map<MessageCenterPlatformItem>((ticket) => {
    const category = ticket.category === "payment" ? "financeiro" : "suporte";

    return {
      body:
        ticket.resolution_summary ??
        ticket.description ??
        "A equipe TES está acompanhando este chamado.",
      category,
      categoryLabel: getCategoryLabel(category),
      id: ticket.id,
      isUnread: ticket.status !== "resolved",
      timeLabel: formatRelativeTime(ticket.created_at),
      title: ticket.subject,
    };
  });
  const notificationItems = notifications.map<MessageCenterPlatformItem>(
    (notification) => {
      const category =
        notification.kind === "payment" ? "financeiro" : "plataforma";

      return {
        body: notification.body ?? "Atualização operacional da plataforma.",
        category,
        categoryLabel: getCategoryLabel(category),
        id: notification.id,
        isUnread: notification.read_at === null,
        timeLabel: formatRelativeTime(notification.created_at),
        title: notification.title,
      };
    },
  );

  return [...notificationItems, ...ticketItems].slice(0, 5);
}

function createMessageCenterShell(
  actorRole: MessageCenterActorRole,
): Omit<
  MessageCenterPageData,
  "metrics" | "platformItems" | "source" | "supportTickets" | "threads"
> {
  const isTherapist = actorRole === "therapist";

  return {
    actorRole,
    hero: {
      description: isTherapist
        ? "Acompanhe mensagens automatizadas dos clientes, avisos da plataforma e suporte em um só lugar."
        : "Acompanhe mensagens automatizadas dos terapeutas, avisos da plataforma e suporte em um só lugar.",
      pendingLabel: isTherapist
        ? "Clientes aguardando"
        : "Terapeutas aguardando",
      title: "Central de mensagens",
    },
    participantSection: {
      description: isTherapist
        ? "Comunicações por templates relacionadas às sessões e ao acompanhamento."
        : "Comunicações por templates relacionadas aos seus encontros.",
      title: isTherapist
        ? "Mensagens dos clientes"
        : "Mensagens dos terapeutas",
    },
    platformSection: {
      description:
        "Comunicados da plataforma, financeiro, suporte e avisos operacionais.",
      title: "Plataforma e suporte TES",
    },
    templates: {
      participant: getParticipantTemplates(actorRole),
      support: getSupportTemplates(actorRole),
    },
  };
}

function createDemoMessageCenter(
  actorRole: MessageCenterActorRole,
): MessageCenterPageData {
  const shell = createMessageCenterShell(actorRole);
  const isTherapist = actorRole === "therapist";
  const people = isTherapist
    ? [
        "Beatriz Lima",
        "André Lima",
        "Sofia Mendes",
        "Mariana Alves",
        "Lucas Ferreira",
      ]
    : [
        "Ana Oliveira",
        "Juliana Costa",
        "André Lima",
        "Sofia Mendes",
        "Roberto Vaz",
      ];
  const categories: MessageCenterCategory[] = [
    "duvida",
    "confirmacao",
    "reagendamento",
    "acompanhamento",
    "feedback",
  ];

  return {
    ...shell,
    metrics: { awaitingCount: 5, unreadCount: 8 },
    platformItems: [
      {
        body: "Implementamos melhorias para agilizar o processo.",
        category: "suporte",
        categoryLabel: "Suporte TES",
        id: "platform-1",
        isUnread: true,
        timeLabel: "Hoje · 11:20",
        title: "Atualização no fluxo de reembolso",
      },
      {
        body: "O valor já está disponível na sua conta.",
        category: "financeiro",
        categoryLabel: "Financeiro",
        id: "platform-2",
        isUnread: false,
        timeLabel: "Ontem · 09:08",
        title: isTherapist
          ? "Seu repasse da semana foi concluído"
          : "Seu comprovante foi atualizado",
      },
      {
        body: "Você já pode usar lembretes automatizados pela plataforma.",
        category: "plataforma",
        categoryLabel: "Plataforma",
        id: "platform-3",
        isUnread: true,
        timeLabel: "16 Jun · 16:30",
        title: "Nova funcionalidade: lembretes automáticos",
      },
    ],
    supportTickets: [],
    source: "demo",
    threads: people.map((name, index) => {
      const category = categories[index] ?? "acompanhamento";

      return {
        avatarUrl: null,
        bookingId: null,
        body:
          shell.templates.participant[
            index % shell.templates.participant.length
          ]?.body ?? "",
        category,
        categoryLabel: getCategoryLabel(category),
        conversationId: `demo-conversation-${index + 1}`,
        id: `demo-thread-${index + 1}`,
        isUnread: index < 3,
        name,
        timeLabel:
          index < 2 ? `Hoje · ${10 - index}:32` : `${16 + index} Jun · 14:10`,
        title: getThreadTitle(category),
        cta: null,
        sessionContext: null,
      };
    }),
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

async function getRowsByIds<T>(
  config: SupabaseServerConfig,
  table: string,
  select: string,
  ids: string[],
): Promise<T[]> {
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  if (uniqueIds.length === 0) return [];

  return supabaseRequest<T[]>(
    config,
    `/rest/v1/${table}?select=${select}&id=in.(${uniqueIds.join(",")})`,
  );
}

function inferCategory(value: string): MessageCenterCategory {
  const normalized = value.toLocaleLowerCase("pt-BR");

  if (normalized.includes("reagend")) return "reagendamento";
  if (normalized.includes("confirm") || normalized.includes("presen")) {
    return "confirmacao";
  }
  if (normalized.includes("dúvida") || normalized.includes("duvida")) {
    return "duvida";
  }
  if (normalized.includes("obrigad") || normalized.includes("agradec")) {
    return "feedback";
  }
  if (normalized.includes("pagamento") || normalized.includes("repasse")) {
    return "financeiro";
  }

  return "acompanhamento";
}

function getThreadTitle(category: MessageCenterCategory) {
  const titles: Record<MessageCenterCategory, string> = {
    acompanhamento: "Acompanhamento da sessão",
    atendimento: "Atualização de atendimento",
    atualizacao: "Atualização importante",
    confirmacao: "Confirmação de presença na sessão",
    duvida: "Dúvida prática sobre a sessão",
    feedback: "Retorno sobre o encontro",
    financeiro: "Atualização financeira",
    plataforma: "Comunicado da plataforma",
    reagendamento: "Pedido de reagendamento",
    suporte: "Atualização de suporte",
  };

  return titles[category];
}

function getCategoryLabel(category: MessageCenterCategory) {
  const labels: Record<MessageCenterCategory, string> = {
    acompanhamento: "Acompanhamento",
    atendimento: "Atendimento",
    atualizacao: "Atualização",
    confirmacao: "Confirmação",
    duvida: "Dúvida",
    feedback: "Feedback",
    financeiro: "Financeiro",
    plataforma: "Plataforma",
    reagendamento: "Reagendamento",
    suporte: "Suporte TES",
  };

  return labels[category];
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "Sem data";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Sem data";

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (sameDay) return `Hoje · ${time}`;
  if (date.toDateString() === yesterday.toDateString())
    return `Ontem · ${time}`;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}
