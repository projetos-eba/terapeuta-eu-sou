import type {
  AdminOperationAuditEvent,
  AdminOperationDetailPageData,
  AdminOperationDetailSection,
  AdminOperationField,
  AdminOperationModuleKey,
  AdminOperationRow,
} from "./admin-operations.types";
import { routes } from "@/lib/routes";

type UnknownRecord = Record<string, unknown>;

export function mapAdminOperationRows({
  module,
  rows,
}: {
  module: AdminOperationModuleKey;
  rows: unknown[];
}): AdminOperationRow[] {
  return rows.filter(isRecord).map((row, index) => {
    if (module === "professionals") return mapProfessionalRow(row, index);
    if (module === "verifications") return mapVerificationRow(row, index);
    if (module === "patients") return mapPatientRow(row, index);
    if (module === "sessions") return mapSessionRow(row, index);
    if (module === "support") return mapSupportRow(row, index);
    return mapReviewRow(row, index);
  });
}

function mapProfessionalRow(row: UnknownRecord, index: number) {
  const id = asText(row.id) || `professional-${index}`;

  return {
    detailHref: getAdminOperationDetailHref("professionals", id),
    fields: compactFields([
      field("Plano", asText(row.plan)),
      field("Perfil público", asText(row.public_status)),
      field("Publicado", asBooleanLabel(row.is_public)),
      field("Reservas", asBooleanLabel(row.is_accepting_bookings)),
      field("Publicação", publicationLabel(row.publication_eligibility)),
      field("Pendências de publicação", publicationBlockers(row.publication_blockers)),
      field("Verificação", asText(row.verification_status)),
      field("Serviços", formatCount(row.service_count)),
      field("Stripe Connect", asText(row.connect_status)),
      field("Próxima sessão", formatDate(row.next_session_at)),
      field("Atualizado", formatDate(row.updated_at)),
    ]),
    id,
    statusLabel: asText(row.status),
    subtitle: asText(row.slug),
    title: asText(row.public_name) || "Profissional sem nome público",
  } satisfies AdminOperationRow;
}

function mapVerificationRow(row: UnknownRecord, index: number) {
  const therapistName = asText(row.therapist_name);
  const id = asText(row.id) || `verification-${index}`;

  return {
    detailHref: getAdminOperationDetailHref("verifications", id),
    fields: compactFields([
      field("Perfil", asText(row.therapist_profile_id)),
      field("Enviado", formatDate(row.submitted_at)),
      field("Revisado", formatDate(row.reviewed_at)),
      field("Publicação", publicationLabel(row.publication_eligibility)),
      field("Pendências de publicação", publicationBlockers(row.publication_blockers)),
      field("Atualizado", formatDate(row.updated_at)),
    ]),
    id,
    statusLabel: asText(row.status),
    subtitle: "Documentos privados não são exibidos nesta lista.",
    title: therapistName || `Verificação ${shortId(asText(row.id))}`,
  } satisfies AdminOperationRow;
}

function mapPatientRow(row: UnknownRecord, index: number) {
  const id = asText(row.id) || `patient-${index}`;

  return {
    detailHref: getAdminOperationDetailHref("patients", id),
    fields: compactFields([
      field("Status", asText(row.account_status)),
      field("Fuso", asText(row.timezone)),
      field("Reservas", formatCount(row.booking_count)),
      field("Tickets", formatCount(row.ticket_count)),
      field("Última atividade", formatDate(row.last_activity_at)),
      field("Criado", formatDate(row.created_at)),
    ]),
    id,
    subtitle: asText(row.user_id),
    title: asText(row.display_name) || "Paciente sem nome",
  } satisfies AdminOperationRow;
}

function mapSessionRow(row: UnknownRecord, index: number) {
  const id = asText(row.id) || `session-${index}`;

  return {
    detailHref: getAdminOperationDetailHref("sessions", id),
    fields: compactFields([
      field("Terapeuta", asText(row.therapist_name)),
      field("Cliente", asText(row.patient_name)),
      field("Pagamento", asText(row.payment_status)),
      field("Início", formatDate(row.starts_at)),
      field("Término", formatDate(row.ends_at)),
      field("Fuso", asText(row.timezone)),
      field("Duração", formatMinutes(row.service_duration_minutes_snapshot)),
      field("Atualizada", formatDate(row.updated_at)),
    ]),
    id,
    statusLabel: asText(row.status),
    subtitle: `Booking ${shortId(asText(row.id))}`,
    title: asText(row.service_title_snapshot) || "Sessão sem título",
  } satisfies AdminOperationRow;
}

function mapSupportRow(row: UnknownRecord, index: number) {
  const id = asText(row.id) || `support-${index}`;

  return {
    detailHref: getAdminOperationDetailHref("support", id),
    fields: compactFields([
      field("Solicitante", asText(row.requester_name)),
      field("Perfil", asText(row.requester_role)),
      field("Categoria", asText(row.category)),
      field("Prioridade", asText(row.priority)),
      field("Urgência", asText(row.urgency)),
      field("Origem", asText(row.source)),
      field("Criado", formatDate(row.created_at)),
      field("Atualizado", formatDate(row.updated_at)),
    ]),
    id,
    statusLabel: asText(row.status),
    subtitle: `Ticket ${shortId(asText(row.id))}`,
    title: asText(row.subject) || "Ticket sem assunto",
  } satisfies AdminOperationRow;
}

function mapReviewRow(row: UnknownRecord, index: number) {
  const id = asText(row.id) || `review-${index}`;

  return {
    detailHref: getAdminOperationDetailHref("reviews", id),
    fields: compactFields([
      field("Terapeuta", asText(row.therapist_name)),
      field("Nota", asText(row.rating)),
      field("Publicada", formatDate(row.published_at)),
      field("Criada", formatDate(row.created_at)),
      field("Atualizada", formatDate(row.updated_at)),
      field("Motivo de moderação", asText(row.moderation_reason)),
    ]),
    id,
    statusLabel: asText(row.status),
    subtitle: `Booking ${shortId(asText(row.booking_id))}`,
    title: "Avaliação operacional",
  } satisfies AdminOperationRow;
}

export function mapAdminOperationDetail({
  auditEvents,
  generatedAt,
  module,
  record,
}: {
  auditEvents: unknown[];
  generatedAt: string;
  module: AdminOperationModuleKey;
  record: UnknownRecord;
}): AdminOperationDetailPageData {
  const id = asText(record.id);
  const row = mapAdminOperationRows({ module, rows: [record] })[0];

  return {
    auditEvents: auditEvents.filter(isRecord).map(mapAuditEvent),
    backHref: getAdminOperationBackHref(module),
    generatedAt,
    id,
    module,
    safetyNotes: getDetailSafetyNotes(module),
    sections: getDetailSections(module, record),
    statusLabel: row?.statusLabel,
    subtitle: row?.subtitle,
    title: row?.title ?? getFallbackDetailTitle(module, id),
  };
}

function getDetailSections(
  module: AdminOperationModuleKey,
  record: UnknownRecord,
): AdminOperationDetailSection[] {
  if (module === "professionals") {
    return [
      section("Identidade operacional", [
        field("ID do perfil", asText(record.id)),
        field("Usuário", asText(record.user_id)),
        field("Slug público", asText(record.slug)),
        field("Cidade", asLocation(record.city, record.state, record.country)),
        field("Idiomas", asList(record.languages)),
      ]),
      section("Estado do perfil", [
        field("Plano", asText(record.plan)),
        field("Status interno", asText(record.status)),
        field("Status público", asText(record.public_status)),
        field("Publicado", asBooleanLabel(record.is_public)),
        field("Recebe reservas", asBooleanLabel(record.is_accepting_bookings)),
        field(
          "Atendimento online",
          asBooleanLabel(record.accepts_online_sessions),
        ),
        field("Elegibilidade pública", publicationLabel(record.publication_eligibility)),
        field("Bloqueadores reais", publicationBlockers(record.publication_blockers)),
        field("Última verificação", asText(record.verification_status)),
      ]),
      section("Operação", [
        field("Serviços totais", formatCount(record.service_count)),
        field("Serviços ativos", formatCount(record.active_service_count)),
        field("Sessões totais", formatCount(record.total_booking_count)),
        field("Sessões futuras", formatCount(record.future_booking_count)),
        field("Stripe Connect", asText(record.connect_status)),
        field("Próxima sessão", formatDate(record.next_session_at)),
      ]),
      timestampSection(record),
    ];
  }

  if (module === "patients") {
    return [
      section("Identidade operacional", [
        field("ID do perfil", asText(record.id)),
        field("Usuário", asText(record.user_id)),
        field("Status da conta", asText(record.account_status)),
        field("Fuso horário", asText(record.timezone)),
        field("Marketing", asBooleanLabel(record.marketing_consent)),
      ]),
      section("Atividade", [
        field("Reservas totais", formatCount(record.booking_count)),
        field("Reservas futuras", formatCount(record.future_booking_count)),
        field("Tickets", formatCount(record.ticket_count)),
        field("Última atividade", formatDate(record.last_activity_at)),
      ]),
      timestampSection(record),
    ];
  }

  if (module === "sessions") {
    const videoSession = asRecordOrNull(record.video_session);

    return [
      section("Sessão", [
        field("Status", asText(record.status)),
        field("Pagamento", asText(record.payment_status)),
        field("Serviço", asText(record.service_title_snapshot)),
        field(
          "Duração",
          formatMinutes(record.service_duration_minutes_snapshot),
        ),
      ]),
      section("Agenda", [
        field("Início", formatDate(record.starts_at)),
        field("Término", formatDate(record.ends_at)),
        field("Fuso", asText(record.timezone)),
        field("Concluída em", formatDate(record.completed_at)),
        field("Cancelada em", formatDate(record.cancelled_at)),
      ]),
      section("Participantes", [
        field("Terapeuta", asText(record.therapist_name)),
        field("Cliente", asText(record.patient_name)),
        field("Formato", formatMeetingMode(record.meeting_provider)),
      ]),
      section("Sala online", getVideoSessionLifecycleFields(videoSession)),
      section(
        "Participação na sala",
        getVideoSessionParticipationFields(videoSession),
      ),
      section(
        "Acompanhamento do encerramento",
        getVideoSessionControlJobFields(videoSession),
      ),
      timestampSection(record),
    ];
  }

  if (module === "support") {
    return [
      section("Ticket", [
        field("Ticket", asText(record.id)),
        field("Assunto", asText(record.subject)),
        field("Categoria", asText(record.category)),
        field("Status", asText(record.status)),
        field("Prioridade", asText(record.priority)),
        field("Urgência", asText(record.urgency)),
        field("Origem", asText(record.source)),
      ]),
      section("Relacionamentos", [
        field("Solicitante", asText(record.requester_name)),
        field("Perfil solicitante", asText(record.requester_role)),
        field("ID solicitante", asText(record.requester_profile_id)),
        field("Booking relacionado", asText(record.booking_id)),
      ]),
      timestampSection(record),
    ];
  }

  if (module === "reviews") {
    return [
      section("Avaliação", [
        field("Avaliação", asText(record.id)),
        field("Nota", asText(record.rating)),
        field("Status", asText(record.status)),
        field("Motivo de moderação", asText(record.moderation_reason)),
        field("Publicada em", formatDate(record.published_at)),
      ]),
      section("Relacionamentos", [
        field("Terapeuta", asText(record.therapist_name)),
        field("Perfil terapeuta", asText(record.therapist_profile_id)),
        field("Perfil cliente", asText(record.patient_profile_id)),
        field("Booking", asText(record.booking_id)),
      ]),
      timestampSection(record),
    ];
  }

  return [
    section("Verificação", [
      field("Verificação", asText(record.id)),
      field("Status", asText(record.status)),
      field("Terapeuta", asText(record.therapist_name)),
      field("Perfil terapeuta", asText(record.therapist_profile_id)),
      field(
        "Ajuste solicitado",
        asBooleanLabel(record.changes_requested_present),
      ),
      field(
        "Reprovação registrada",
        asBooleanLabel(record.rejection_reason_present),
      ),
      field("Revisado por", asText(record.reviewed_by)),
      field("Enviado em", formatDate(record.submitted_at)),
      field("Revisado em", formatDate(record.reviewed_at)),
      field("Estado administrativo do perfil", asText(record.profile_status)),
      field("Elegibilidade pública", publicationLabel(record.publication_eligibility)),
      field("Bloqueadores reais", publicationBlockers(record.publication_blockers)),
    ]),
    timestampSection(record),
  ];
}

function compactFields(fields: Array<AdminOperationField | null>) {
  return fields.filter(Boolean) as AdminOperationField[];
}

function section(
  title: string,
  fields: Array<AdminOperationField | null>,
  description?: string,
): AdminOperationDetailSection {
  return {
    description,
    fields: compactFields(fields),
    title,
  };
}

function timestampSection(record: UnknownRecord) {
  return section("Rastreabilidade", [
    field("Criado em", formatDate(record.created_at)),
    field("Atualizado em", formatDate(record.updated_at)),
  ]);
}

function field(label: string, value: string) {
  return value ? { label, value } : null;
}

function asRecordOrNull(value: unknown): UnknownRecord | null {
  return isRecord(value) ? value : null;
}

function asRecordArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asText(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function asBooleanLabel(value: unknown) {
  if (value === true) return "Sim";
  if (value === false) return "Não";

  return "";
}

function publicationLabel(value: unknown) {
  if (!isRecord(value)) return "";
  return value.eligible === true
    ? "Publicado e elegível"
    : "Aprovado · publicação pendente";
}

function publicationBlockers(value: unknown) {
  if (!Array.isArray(value)) return "";
  const labels: Record<string, string> = {
    no_active_bookable_online_service: "nenhum serviço publicável",
    not_accepting_bookings: "não aceita novos agendamentos",
    online_sessions_disabled: "atendimento online desativado",
    profile_not_approved: "cadastro ainda não aprovado",
    profile_not_public: "perfil público desativado",
    therapy_category_inactive: "categoria da terapia inativa",
    therapy_not_public: "terapia não publicada ou não visível",
  };
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => labels[item] ?? item)
    .join(" · ");
}

function formatMinutes(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";

  return `${value} min`;
}

function formatCount(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";

  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function shortId(value: string) {
  return value ? value.slice(0, 8) : "sem-id";
}

function getVideoSessionLifecycleFields(videoSession: UnknownRecord | null) {
  if (!videoSession) {
    return [
      field(
        "Situação da sala",
        "A sala online ainda não possui atividade registrada.",
      ),
    ];
  }

  return [
    field(
      "Situação da sala",
      formatVideoSessionStatus(asText(videoSession.status)),
    ),
    field("Início real", formatDate(videoSession.actual_started_at)),
    field("Fim real", formatDate(videoSession.actual_ended_at)),
    field("Limite de segurança", formatDate(videoSession.hard_ends_at)),
    field(
      "Profissional na sala",
      formatTherapistPresence(videoSession.therapist_present),
    ),
    field(
      "Participantes ativos",
      formatParticipantCount(videoSession.participant_count),
    ),
    field(
      "Último evento recebido",
      formatDate(videoSession.last_provider_event_at),
    ),
    field(
      "Motivo do encerramento",
      formatVideoSessionTerminationReason(
        asText(videoSession.termination_reason),
      ),
    ),
  ];
}

function getVideoSessionParticipationFields(
  videoSession: UnknownRecord | null,
) {
  if (!videoSession) {
    return [
      field(
        "Resumo da participação",
        "Ainda não há movimentações registradas para a sala online desta sessão.",
      ),
    ];
  }

  const participations = asRecordArray(videoSession.participations);
  const latestTherapistEvent = getLatestParticipationByRole(
    participations,
    "therapist",
  );
  const latestPatientEvent = getLatestParticipationByRole(
    participations,
    "patient",
  );

  if (participations.length === 0) {
    return [
      field(
        "Resumo da participação",
        "A sala online já existe, mas ainda não recebeu movimentações registradas.",
      ),
    ];
  }

  return [
    field("Movimentações recentes", formatCount(participations.length)),
    field(
      "Primeira entrada do profissional",
      formatDate(videoSession.therapist_first_joined_at),
    ),
    field(
      "Última entrada do profissional",
      formatDate(videoSession.therapist_last_joined_at),
    ),
    field(
      "Última saída do profissional",
      formatDate(videoSession.therapist_last_left_at),
    ),
    field(
      "Última saída registrada",
      formatDate(videoSession.last_participant_left_at),
    ),
    field(
      "Movimentação mais recente do profissional",
      formatParticipationSummary(latestTherapistEvent),
    ),
    field(
      "Movimentação mais recente do cliente",
      formatParticipationSummary(latestPatientEvent),
    ),
  ];
}

function getVideoSessionControlJobFields(videoSession: UnknownRecord | null) {
  if (!videoSession) {
    return [
      field(
        "Acompanhamento do encerramento",
        "Ainda não há acompanhamento automático registrado para esta sessão.",
      ),
    ];
  }

  const controlJobs = asRecordArray(videoSession.control_jobs);
  const latestJob = controlJobs[0] ?? null;

  if (!latestJob) {
    return [
      field(
        "Acompanhamento do encerramento",
        "Nenhum acompanhamento automático foi necessário até agora.",
      ),
    ];
  }

  return [
    field("Acompanhamentos registrados", formatCount(controlJobs.length)),
    field(
      "Objetivo do acompanhamento",
      formatControlJobOperation(asText(latestJob.operation)),
    ),
    field(
      "Situação do acompanhamento",
      formatControlJobStatus(asText(latestJob.status)),
    ),
    field(
      "Tentativas",
      formatAttemptSummary(latestJob.attempts, latestJob.max_attempts),
    ),
    field("Próxima tentativa", formatDate(latestJob.next_run_at)),
    field("Concluído em", formatDate(latestJob.completed_at)),
    field(
      "Última atualização",
      formatDate(latestJob.updated_at) || formatDate(latestJob.created_at),
    ),
  ];
}

function getLatestParticipationByRole(
  participations: UnknownRecord[],
  role: "patient" | "therapist",
) {
  return (
    participations.find(
      (participation) => asText(participation.participant_role) === role,
    ) ?? null
  );
}

function formatVideoSessionStatus(value: string) {
  const labels: Record<string, string> = {
    active: "Em andamento",
    canceled: "Cancelada",
    ended: "Encerrada",
    failed: "Com problema",
    ready: "Pronta para iniciar",
  };

  return labels[value.toLowerCase()] ?? "Situação indisponível";
}

function formatVideoSessionTerminationReason(value: string) {
  const labels: Record<string, string> = {
    hard_timeout: "Encerrada ao atingir o limite de segurança",
    host_left: "Encerrada após a saída do profissional",
    manual_end: "Encerrada manualmente",
    provider_ended: "Encerrada pela própria sala online",
    reconcile_orphan: "Encerrada após conferência automática",
    therapist_absent: "Encerrada por ausência do profissional",
  };

  return labels[value.toLowerCase()] ?? "Motivo não informado";
}

function formatTherapistPresence(value: unknown) {
  if (value === true) return "Profissional presente agora";
  if (value === false) return "Profissional fora da sala no momento";
  return "";
}

function formatParticipantCount(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  if (value === 0) return "Nenhuma pessoa ativa agora";
  if (value === 1) return "1 pessoa ativa agora";
  return `${new Intl.NumberFormat("pt-BR").format(value)} pessoas ativas agora`;
}

function formatParticipationSummary(participation: UnknownRecord | null) {
  if (!participation) return "";

  const role = formatParticipationRole(asText(participation.participant_role));
  const action = formatParticipationAction(asText(participation.event_type));
  const happenedAt =
    formatDate(participation.left_at) ||
    formatDate(participation.joined_at) ||
    formatDate(participation.created_at);
  const duration = formatParticipationDuration(participation.duration_seconds);

  const segments = [
    role,
    action,
    happenedAt ? `em ${happenedAt}` : "",
    duration,
  ]
    .filter(Boolean)
    .join(" ");

  return segments.trim();
}

function formatParticipationRole(value: string) {
  const labels: Record<string, string> = {
    patient: "Cliente",
    therapist: "Profissional",
    unknown: "Participante",
  };

  return labels[value.toLowerCase()] ?? "Participante";
}

function formatParticipationAction(value: string) {
  const labels: Record<string, string> = {
    "session.user_joined": "entrou na sala",
    "session.user_left": "saiu da sala",
  };

  return labels[value.toLowerCase()] ?? "teve uma movimentação";
}

function formatParticipationDuration(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    return "";
  }

  const minutes = Math.floor(value / 60);

  if (minutes < 1) {
    return `(${value}s de permanência)`;
  }

  return `(${minutes} min de permanência)`;
}

function formatControlJobOperation(value: string) {
  const labels: Record<string, string> = {
    confirm_end: "Confirmar o encerramento da sala",
    end_hard_timeout: "Encerrar ao atingir o limite de segurança",
    end_therapist_absent: "Encerrar por ausência do profissional",
    reconcile_orphan: "Conferir sala sem vínculo confirmado",
  };

  return labels[value.toLowerCase()] ?? "Acompanhamento automático";
}

function formatControlJobStatus(value: string) {
  const labels: Record<string, string> = {
    dead_letter: "Precisa de atenção manual",
    done: "Concluído",
    processing: "Em andamento",
    queued: "Aguardando execução",
    retry: "Nova tentativa agendada",
  };

  return labels[value.toLowerCase()] ?? "Situação indisponível";
}

function formatAttemptSummary(attempts: unknown, maxAttempts: unknown) {
  if (
    typeof attempts !== "number" ||
    !Number.isFinite(attempts) ||
    typeof maxAttempts !== "number" ||
    !Number.isFinite(maxAttempts)
  ) {
    return "";
  }

  return `${new Intl.NumberFormat("pt-BR").format(attempts)} de ${new Intl.NumberFormat("pt-BR").format(maxAttempts)}`;
}

function formatMeetingMode(value: unknown) {
  if (asText(value)) return "Online";
  return "";
}

function asList(value: unknown) {
  if (!Array.isArray(value)) return "";

  return value.map(asText).filter(Boolean).join(", ");
}

function asLocation(city: unknown, state: unknown, country: unknown) {
  return [asText(city), asText(state), asText(country)]
    .filter(Boolean)
    .join(", ");
}

function mapAuditEvent(row: UnknownRecord): AdminOperationAuditEvent {
  return {
    action: asText(row.action) || "evento",
    actorRole: asText(row.actor_role) || "admin",
    createdAt: asText(row.created_at),
    id: asText(row.id) || crypto.randomUUID(),
    permission: asText(row.permission) || null,
    reason: asText(row.reason) || null,
    source: asText(row.source) || "admin",
  };
}

function getAdminOperationBackHref(module: AdminOperationModuleKey) {
  if (module === "professionals") return routes.admin.professionals;
  if (module === "verifications") return routes.admin.verifications;
  if (module === "patients") return routes.admin.patients;
  if (module === "sessions") return routes.admin.sessions;
  if (module === "support") return routes.admin.support;

  return routes.admin.reviews;
}

function getAdminOperationDetailHref(
  module: AdminOperationModuleKey,
  id: string,
) {
  if (!id) return undefined;
  if (module === "professionals") return routes.admin.professionalDetail(id);
  if (module === "verifications") return routes.admin.verificationDetail(id);
  if (module === "patients") return routes.admin.patientDetail(id);
  if (module === "sessions") return routes.admin.sessionDetail(id);
  if (module === "support") return routes.admin.supportDetail(id);

  return routes.admin.reviewDetail(id);
}

function getFallbackDetailTitle(module: AdminOperationModuleKey, id: string) {
  if (module === "professionals") return `Profissional ${shortId(id)}`;
  if (module === "verifications") return `Verificação ${shortId(id)}`;
  if (module === "patients") return `Cliente ${shortId(id)}`;
  if (module === "sessions") return `Sessão ${shortId(id)}`;
  if (module === "support") return `Ticket ${shortId(id)}`;

  return `Avaliação ${shortId(id)}`;
}

function getDetailSafetyNotes(module: AdminOperationModuleKey) {
  const common = [
    "Detalhe administrativo carregado por RPC segura, com validação server-side de admin.",
    "Eventos de auditoria não exibem estados completos nem payloads sensíveis.",
  ];

  if (module === "sessions") {
    return [
      ...common,
      "URL secreta, JWT, senha de sala e payload Zoom não são expostos neste detalhe.",
    ];
  }

  if (module === "support") {
    return [
      ...common,
      "Descrição completa do ticket permanece fora desta visão até existir fluxo de atendimento com política própria.",
    ];
  }

  if (module === "reviews") {
    return [
      ...common,
      "Comentário completo da avaliação não aparece no detalhe operacional desta fase.",
    ];
  }

  if (module === "verifications") {
    return [
      ...common,
      "Documentos privados e metadados brutos de verificação não são expostos.",
    ];
  }

  if (module === "patients") {
    return [
      ...common,
      "Dados clínicos, jornada sensível e comunicações privadas do cliente não são carregados.",
    ];
  }

  return [
    ...common,
    "Plano de assinatura e publicação não devem ser alterados diretamente neste detalhe.",
  ];
}
