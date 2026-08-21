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
  category: MessageCenterCategory;
  categoryLabel: string;
  conversationId: string | null;
  id: string;
  isUnread: boolean;
  name: string;
  timeLabel: string;
  title: string;
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
  key: string;
  label: string;
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
