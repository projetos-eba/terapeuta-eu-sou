type AuditEventInput = {
  actorRole: string;
  entityType: string;
  eventType: string;
};

export type AdminAuditEventLabel = {
  action: string;
  actorRole: string;
  entityType: string;
};

const actionLabels: Record<string, string> = {
  matching_theme_created: "Tema de recomendação criado",
  matching_theme_edited: "Tema de recomendação atualizado",
  matching_theme_removed: "Tema de recomendação removido",
  "professional.publish": "Perfil profissional publicado",
  "professional.reactivate": "Profissional reativado",
  "professional.suspend": "Profissional suspenso",
  "review.hide": "Avaliação ocultada",
  "review.restore": "Avaliação restaurada",
  "session_confirmation_incident.resolve": "Ocorrência da sessão analisada",
  "support.internal_note": "Nota interna adicionada ao atendimento",
  "support.reopen": "Atendimento reaberto",
  "support.reply": "Resposta enviada no atendimento",
  "support.resolve": "Atendimento concluído",
  therapy_archive: "Terapia arquivada",
  therapy_deprecate: "Terapia descontinuada",
  therapy_draft_created: "Rascunho de terapia criado",
  therapy_edited: "Terapia atualizada",
  therapy_publish: "Terapia publicada",
  therapy_request_submitted: "Solicitação de terapia recebida",
  therapy_review: "Terapia encaminhada para análise",
  therapy_unpublish: "Terapia retirada de publicação",
  "verification.approve": "Verificação aprovada",
  "verification.pause_review": "Análise pausada para ajustes",
  "verification.reject": "Verificação não aprovada",
  "verification.reopen_review": "Análise iniciada ou reaberta",
  "verification.request_changes": "Ajustes solicitados na verificação",
};

const entityTypeLabels: Record<string, string> = {
  matching_theme: "tema de recomendação",
  session_confirmation_incident: "ocorrência da sessão",
  support_ticket: "atendimento",
  therapist_profile: "perfil profissional",
  therapist_verification: "verificação profissional",
  therapy: "terapia",
  therapy_catalog_request: "solicitação de terapia",
};

const actorRoleLabels: Record<string, string> = { admin: "Administração" };

export function getAdminAuditEventLabel({
  actorRole,
  entityType,
  eventType,
}: AuditEventInput): AdminAuditEventLabel {
  return {
    action: actionLabels[normalize(eventType)] ?? "Atualização administrativa",
    actorRole: actorRoleLabels[normalize(actorRole)] ?? "Administração",
    entityType:
      entityTypeLabels[normalize(entityType)] ?? "registro administrativo",
  };
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
