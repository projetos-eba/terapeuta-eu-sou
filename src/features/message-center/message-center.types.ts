export type MessageCenterActorRole = "patient" | "therapist";

export type MessageCenterCategory =
  | "acompanhamento"
  | "atendimento"
  | "atualizacao"
  | "confirmacao"
  | "duvida"
  | "feedback"
  | "financeiro"
  | "plataforma"
  | "reagendamento"
  | "suporte";

export type MessageCenterThread = {
  avatarUrl: string | null;
  body: string;
  bookingId: string | null;
  category: MessageCenterCategory;
  categoryLabel: string;
  conversationId: string | null;
  id: string;
  isUnread: boolean;
  name: string;
  timeLabel: string;
  title: string;
  cta: MessageCenterCta | null;
  sessionContext: string | null;
};

export type MessageCenterCta = {
  action:
    | "view_session"
    | "open_session"
    | "reschedule_session"
    | "cancel_session";
  href: string;
  label: string;
};

export type MessageCenterPlatformItem = {
  body: string;
  category: MessageCenterCategory;
  categoryLabel: string;
  id: string;
  isUnread: boolean;
  timeLabel: string;
  title: string;
};

export type MessageCenterSupportTicket = {
  category: string;
  createdAt: string;
  id: string;
  lastActivityAt: string;
  status: string;
  subject: string;
};

export type MessageCenterTemplate = {
  body: string;
  category: MessageCenterCategory;
  description: string;
  key: string;
  label: string;
  parameters?: Array<{
    key: string;
    label: string;
    options: Array<{ label: string; value: string }>;
  }>;
  requiresBooking?: boolean;
  ctaAction?: MessageCenterCta["action"];
};

export type MessageCenterPageData = {
  actorRole: MessageCenterActorRole;
  hero: {
    description: string;
    pendingLabel: string;
    title: string;
  };
  metrics: {
    awaitingCount: number;
    unreadCount: number;
  };
  participantSection: {
    description: string;
    title: string;
  };
  platformSection: {
    description: string;
    title: string;
  };
  platformItems: MessageCenterPlatformItem[];
  supportTickets: MessageCenterSupportTicket[];
  source: "demo" | "supabase";
  templates: {
    participant: MessageCenterTemplate[];
    support: MessageCenterTemplate[];
  };
  threads: MessageCenterThread[];
};
