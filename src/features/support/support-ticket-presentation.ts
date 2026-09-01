import type {
  SupportTicketCategory,
  SupportTicketStatus,
} from "./support-contracts";

export type SupportTicketViewer = "admin" | "requester";

type StatusPresentation = {
  label: string;
  tone: "brand" | "soft" | "success";
};

export const supportTicketWaitingSupportMessage =
  "A equipe TES foi avisada sobre sua mensagem. Se precisar, você pode enviar outros complementos ou anexos enquanto aguarda a resposta.";
export const supportTicketAttachmentGuidance =
  "Até 5 arquivos, com até 10 MB cada. Formatos permitidos: PDF, JPG, PNG ou WebP.";
export const supportTicketAttachmentErrorMessage =
  "Não foi possível enviar o anexo. Use até 5 arquivos de até 10 MB cada, nos formatos PDF, JPG, PNG ou WebP.";

const categoryLabels: Record<SupportTicketCategory, string> = {
  agenda_sessoes: "Agenda e sessões",
  zoom_acesso: "Acesso à sala",
  pagamentos: "Pagamentos",
  financeiro_repasses: "Financeiro e repasses",
  plano_assinatura: "Plano e assinatura",
  perfil_verificacao: "Perfil e verificação",
  conta_acesso: "Conta e acesso",
  outro: "Outro assunto",
};

const requesterStatuses: Record<SupportTicketStatus, StatusPresentation> = {
  open: { label: "Recebemos seu chamado", tone: "soft" },
  in_progress: { label: "Em atendimento pelo TES", tone: "soft" },
  waiting_support: { label: "Aguardando resposta do TES", tone: "brand" },
  waiting_requester: { label: "Aguardando sua resposta", tone: "brand" },
  resolved: { label: "Resolvido", tone: "success" },
};

const adminStatuses: Record<SupportTicketStatus, StatusPresentation> = {
  open: { label: "Novo chamado", tone: "soft" },
  in_progress: { label: "Em atendimento", tone: "soft" },
  waiting_support: {
    label: "Aguardando resposta da equipe TES",
    tone: "brand",
  },
  waiting_requester: {
    label: "Aguardando resposta do solicitante",
    tone: "soft",
  },
  resolved: { label: "Resolvido", tone: "success" },
};

export function getSupportTicketCategoryLabel(category: string) {
  return categoryLabels[category as SupportTicketCategory] ?? "Suporte TES";
}

export function getSupportTicketStatusPresentation(
  status: string,
  viewer: SupportTicketViewer,
): StatusPresentation {
  const statuses = viewer === "admin" ? adminStatuses : requesterStatuses;
  return statuses[status as SupportTicketStatus] ?? statuses.in_progress;
}

export function formatSupportTicketProtocol(
  protocol: string | null | undefined,
) {
  const normalized = protocol?.trim().toUpperCase() ?? "";
  return normalized ? `#${normalized.replace(/^#/, "")}` : "#—";
}

export function formatSupportTicketActivity(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Atualização recente";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}
