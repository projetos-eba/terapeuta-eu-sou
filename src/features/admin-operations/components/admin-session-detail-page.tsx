import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageMain,
} from "@/components/app-page";
import { routes } from "@/lib/routes";

import type { AdminOperationDetailPageData } from "../admin-operations.types";
import {
  AlertTriangle,
  CheckCircle2,
  Star,
} from "lucide-react";

import type {
  AdminSessionFeedbackData,
  AdminSessionFeedbackItem,
} from "../admin-operations.types";
import {
  AsideCard,
  DetailSectionCard,
  EditorialHeader,
  IdentityHero,
  ProductBackLink,
  ProductBreadcrumbs,
  ProductHistory,
  StatsGrid,
  fieldMap,
  findSection,
  formatStatusLabel,
} from "./admin-operation-display";

export function AdminSessionDetailPage({
  data,
}: {
  data: AdminOperationDetailPageData;
}) {
  const session = findSection(data, "Sessão");
  const schedule = findSection(data, "Agenda");
  const participants = findSection(data, "Participantes");
  const onlineRoom = findSection(data, "Sala online");
  const roomParticipation = findSection(data, "Participação na sala");
  const roomFollowUp = findSection(data, "Acompanhamento do encerramento");
  const traceability = findSection(data, "Rastreabilidade");
  const sessionFeedback = data.sessionFeedback;
  const sessionFields = fieldMap(session?.fields ?? []);
  const scheduleFields = fieldMap(schedule?.fields ?? []);
  const participantFields = fieldMap(participants?.fields ?? []);
  const onlineRoomFields = fieldMap(onlineRoom?.fields ?? []);
  const status = formatStatusLabel(data.statusLabel);
  const payment = formatPaymentLabel(sessionFields.get("Pagamento"));
  const roomStatus = onlineRoomFields.get("Situação da sala") ?? "";
  const therapistPresence = onlineRoomFields.get("Profissional na sala") ?? "";
  const participantCount = onlineRoomFields.get("Participantes ativos") ?? "";
  const terminationReason =
    onlineRoomFields.get("Motivo do encerramento") ?? "";
  const latestEvent = onlineRoomFields.get("Último evento recebido") ?? "";
  const roomStatusBadge =
    roomStatus && !isAbsenceMessage(roomStatus)
      ? [{ label: roomStatus, tone: roomTone(roomStatus) }]
      : [];

  const stats = [
    statItem("Duração", sessionFields.get("Duração")),
    statItem("Sala online", !isAbsenceMessage(roomStatus) ? roomStatus : ""),
    statItem("Participantes ativos", participantCount),
    statItem("Profissional na sala", therapistPresence),
    statItem("Pagamento", payment),
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const scheduleSummary = [
    productField("Início", scheduleFields.get("Início")),
    productField("Término", scheduleFields.get("Término")),
    productField("Duração prevista", sessionFields.get("Duração")),
    productField("Fuso horário", scheduleFields.get("Fuso")),
    productField("Concluída em", scheduleFields.get("Concluída em")),
    productField("Cancelada em", scheduleFields.get("Cancelada em")),
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const participantSummary = [
    productField("Profissional", participantFields.get("Terapeuta")),
    productField("ID do profissional", participantFields.get("ID do terapeuta")),
    productField("Cliente", participantFields.get("Cliente")),
    productField("ID do cliente", participantFields.get("ID do cliente")),
    productField("Formato", describeMeeting()),
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const onlineRoomSummary = [
    productField("Situação da sala", roomStatus),
    productField("Início real", onlineRoomFields.get("Início real")),
    productField("Fim real", onlineRoomFields.get("Fim real")),
    productField(
      "Limite de segurança",
      onlineRoomFields.get("Limite de segurança"),
    ),
    productField("Profissional na sala", therapistPresence),
    productField("Participantes ativos", participantCount),
    productField("Último evento recebido", latestEvent),
    productField("Motivo do encerramento", terminationReason),
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const participationSummary = (
    roomParticipation?.fields?.length
      ? roomParticipation.fields
      : [
          {
            label: "Resumo da participação",
            value:
              "Ainda não há movimentações registradas para a sala online desta sessão.",
          },
        ]
  ).filter(Boolean);

  const followUpSummary = (
    roomFollowUp?.fields?.length
      ? roomFollowUp.fields
      : [
          {
            label: "Acompanhamento do encerramento",
            value:
              "Ainda não há acompanhamento automático registrado para esta sessão.",
          },
        ]
  ).filter(Boolean);

  return (
    <AppPageContainer className="max-w-[1320px] py-5 lg:py-6">
      <div className="space-y-6">
        <ProductBackLink href={data.backHref} label="Voltar para sessões" />
        <div className="space-y-4">
          <ProductBreadcrumbs
            items={[
              { href: routes.admin.sessions, label: "Sessões" },
              { label: data.title },
            ]}
          />
          <EditorialHeader
            subtitle="Acompanhe agenda, presença na sala online, encerramento e rastreabilidade operacional da sessão em uma única visão."
            title="Detalhes da sessão"
          />
        </div>

        <IdentityHero
          badges={[
            ...(status ? [{ label: status, tone: statusTone(status) }] : []),
            ...(payment
              ? [{ label: payment, tone: paymentTone(payment) }]
              : []),
            ...roomStatusBadge,
          ]}
          details={
            [
              productField("Profissional", participantFields.get("Terapeuta")),
              productField(
                "ID do profissional",
                participantFields.get("ID do terapeuta"),
              ),
              productField("Cliente", participantFields.get("Cliente")),
              productField(
                "ID do cliente",
                participantFields.get("ID do cliente"),
              ),
              productField("Início", scheduleFields.get("Início")),
              productField(
                "Sala online",
                !isAbsenceMessage(roomStatus) ? roomStatus : "",
              ),
              productField("Formato", describeMeeting()),
            ].filter(Boolean) as Array<{ label: string; value: string }>
          }
          meta={
            [
              sessionFields.get("Duração")
                ? {
                    label: "Duração prevista",
                    value: sessionFields.get("Duração") as string,
                  }
                : null,
              onlineRoomFields.get("Limite de segurança")
                ? {
                    label: "Limite de segurança",
                    value: onlineRoomFields.get(
                      "Limite de segurança",
                    ) as string,
                  }
                : null,
            ].filter(Boolean) as Array<{ label: string; value: string }>
          }
          name={data.title}
          title="Sessão"
        />

        <StatsGrid items={stats} />

        <AppPageGrid className="gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <AppPageMain className="space-y-5">
            <DetailSectionCard
              description="Horários registrados para o atendimento."
              fields={scheduleSummary}
              title="Agenda da sessão"
            />
            <DetailSectionCard
              description="Pessoas vinculadas e formato disponível para o encontro."
              fields={participantSummary}
              title="Participantes"
            />
            <DetailSectionCard
              description="Situação atual da sala online, com horários reais, limite de segurança e último sinal recebido."
              fields={onlineRoomSummary}
              title="Sala online"
            />
            <DetailSectionCard
              description="Resumo das entradas e saídas registradas para profissional e cliente."
              fields={participationSummary}
              title="Participação na sala"
            />
            <DetailSectionCard
              description="Acompanhamentos automáticos usados quando a sala precisa de confirmação ou encerramento."
              fields={followUpSummary}
              title="Acompanhamento do encerramento"
            />
            {sessionFeedback?.status === "available" ? (
              <SessionFeedbackAuditSection data={sessionFeedback.data} />
            ) : null}
            {sessionFeedback?.status === "unavailable" ? (
              <DetailSectionCard
                description="A leitura administrativa do feedback não está disponível neste momento. Nenhuma resposta foi inferida ou substituída."
                fields={[
                  {
                    label: "Situação",
                    value: "Feedback indisponível para consulta",
                  },
                ]}
                title="Feedback pós-sessão"
              />
            ) : null}
            <DetailSectionCard
              description="Registro de criação e atualização desta sessão."
              fields={traceability?.fields ?? []}
              title="Rastreabilidade"
            />
          </AppPageMain>

          <AppPageAside className="space-y-5">
            <AsideCard title="Situação atual">
              <dl className="grid gap-3">
                {[
                  productField("Sessão", status),
                  productField("Pagamento", payment),
                  productField(
                    "Sala online",
                    !isAbsenceMessage(roomStatus) ? roomStatus : "",
                  ),
                  productField("Profissional na sala", therapistPresence),
                  productField("Participantes ativos", participantCount),
                  productField("Último evento recebido", latestEvent),
                  productField("Encerramento", terminationReason),
                  productField("Serviço", sessionFields.get("Serviço")),
                ]
                  .filter(Boolean)
                  .map((field) => (
                    <div
                      className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4"
                      key={field?.label}
                    >
                      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-tesText-muted">
                        {field?.label}
                      </dt>
                      <dd className="mt-2 text-sm font-extrabold text-brand-deep">
                        {field?.value}
                      </dd>
                    </div>
                  ))}
              </dl>
            </AsideCard>
            <AsideCard title="Leitura desta visão">
              <div className="space-y-3">
                <p className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
                  Esta tela reúne horários confirmados, presença e encerramento
                  da sala online para apoiar o acompanhamento da sessão.
                </p>
                <p className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
                  Quando ainda não há atividade registrada, a informação aparece
                  de forma clara, sem preencher lacunas com suposições.
                </p>
              </div>
            </AsideCard>
            <AsideCard title="Histórico administrativo">
              <ProductHistory events={data.auditEvents} />
            </AsideCard>
          </AppPageAside>
        </AppPageGrid>
      </div>
    </AppPageContainer>
  );
}

function SessionFeedbackAuditSection({ data }: { data: AdminSessionFeedbackData }) {
  return (
    <section className="rounded-[28px] border border-brand-lavender/70 bg-white p-6 shadow-[0_22px_60px_rgba(20,16,90,0.09)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-brand-deep">Feedback pós-sessão</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            Respostas privadas registradas por cada participante. O Admin pode auditar, mas não editar opiniões.
          </p>
        </div>
        {data.divergent ? (
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-status-warningBg px-3 text-xs font-extrabold text-status-warning">
            <AlertTriangle aria-hidden="true" size={16} />
            Respostas divergentes
          </span>
        ) : null}
      </div>

      {data.pendingRoles.length > 0 ? (
        <p className="mt-4 rounded-2xl bg-surface-soft px-4 py-3 text-sm font-semibold leading-6 text-tesText-secondary">
          Pendente: {data.pendingRoles.map(feedbackRoleLabel).join(" e ")} ainda não enviou uma resposta.
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <AuditStatusCard
          label="Entrada do cliente"
          value={data.attendance.patientJoined ? "Confirmada" : "Não confirmada"}
          tone={data.attendance.patientJoined ? "success" : "neutral"}
        />
        <AuditStatusCard
          label="Entrada do terapeuta"
          value={data.attendance.therapistJoined ? "Confirmada" : "Não confirmada"}
          tone={data.attendance.therapistJoined ? "success" : "neutral"}
        />
        <AuditStatusCard
          label="Sala encerrada"
          value={data.attendance.sessionClosed ? "Sim" : "Ainda não"}
          tone={data.attendance.sessionClosed ? "success" : "neutral"}
        />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <ConfirmationAuditCard
          confirmation={data.confirmation.patient}
          label="Confirmação do cliente"
        />
        <ConfirmationAuditCard
          confirmation={data.confirmation.therapist}
          label="Confirmação do terapeuta"
        />
      </div>

      <div className="mt-4 rounded-2xl border border-brand-lavender/70 bg-surface-soft p-4">
        <p className="text-sm font-extrabold text-brand-deep">Repasse e prazo de confirmação</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <AuditValue label="Elegibilidade financeira" value={formatFinancialStatus(data.financial)} />
          <AuditValue label="Data de elegibilidade" value={formatFeedbackDate(data.financial?.eligibleAt ?? "")} />
          <AuditValue label="Bloqueio atual" value={formatTransferStatus(data.financial?.transferStatus)} />
        </dl>
        <p className="mt-3 text-xs font-semibold leading-5 text-tesText-muted">
          Esta visão é somente de auditoria. Nenhuma resposta altera opiniões, pagamento ou repasse por conta própria.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <FeedbackAuditCard item={data.patient} label="Cliente" />
        <FeedbackAuditCard item={data.therapist} label="Terapeuta" />
      </div>
    </section>
  );
}

function AuditStatusCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "neutral" | "success";
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-lavender/70 bg-surface-soft p-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-tesText-muted">{label}</p>
      <p className={tone === "success" ? "mt-2 text-sm font-extrabold text-status-success" : "mt-2 text-sm font-extrabold text-tesText-secondary"}>
        {value}
      </p>
    </div>
  );
}

function ConfirmationAuditCard({
  confirmation,
  label,
}: {
  confirmation: AdminSessionFeedbackData["confirmation"]["patient"];
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-lavender/70 bg-white p-4">
      <p className="text-sm font-extrabold text-brand-deep">{label}</p>
      {confirmation ? (
        <dl className="mt-3 grid gap-2 text-sm">
          <AuditValue label="Resultado" value={confirmation.outcome === "completed" ? "Sessão realizada" : "Não realizada"} />
          <AuditValue label="Origem" value={confirmation.source === "automatic" ? "Confirmação automática" : "Confirmação manual"} />
          <AuditValue label="Confirmado em" value={formatFeedbackDate(confirmation.confirmedAt)} />
          <AuditValue label="Prazo original" value={formatFeedbackDate(confirmation.dueAt)} />
        </dl>
      ) : (
        <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">Ainda pendente.</p>
      )}
    </div>
  );
}

function AuditValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-[0.1em] text-tesText-muted">{label}</dt>
      <dd className="mt-1 text-sm font-extrabold text-brand-deep">{value}</dd>
    </div>
  );
}

function formatFinancialStatus(financial: AdminSessionFeedbackData["financial"]) {
  if (!financial) return "Sem dados financeiros";
  if (financial.transferStatus === "eligible") return "Apto, aguardando lote";
  if (financial.transferStatus === "waiting_safety_period") return "Período de segurança";
  if (financial.transferStatus === "not_eligible") return "Não elegível";
  return financial.serviceStatus === "confirmed" ? "Confirmação registrada" : "Em análise";
}

function formatTransferStatus(value: string | undefined) {
  if (!value) return "Sem bloqueio informado";
  const labels: Record<string, string> = {
    eligible: "Nenhum bloqueio",
    not_eligible: "Não elegível",
    waiting_safety_period: "Aguardando período de segurança",
  };
  return labels[value] ?? "Acompanhamento financeiro";
}

function FeedbackAuditCard({
  item,
  label,
}: {
  item: AdminSessionFeedbackItem | null;
  label: string;
}) {
  if (!item) {
    return (
      <article className="rounded-[22px] border border-dashed border-brand-lavender bg-surface-soft p-5">
        <p className="text-sm font-extrabold text-brand-deep">{label}</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">Ainda não enviado.</p>
      </article>
    );
  }

  return (
    <article className="rounded-[22px] border border-brand-lavender/70 bg-surface-soft p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-extrabold text-brand-deep">{label}</p>
        <CheckCircle2 aria-hidden="true" className="text-status-success" size={18} />
      </div>
      <dl className="mt-4 grid gap-3">
        <div>
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-tesText-muted">Resultado</dt>
          <dd className="mt-1 text-sm font-extrabold text-brand-deep">
            {item.outcome === "completed" ? "Sessão realizada" : "Sessão não realizada"}
          </dd>
        </div>
        {item.rating ? (
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.12em] text-tesText-muted">Nota</dt>
            <dd className="mt-1 flex items-center gap-2 text-sm font-extrabold text-brand-deep">
              <Star aria-hidden="true" className="fill-brand-primary text-brand-primary" size={17} />
              {item.rating}/5
            </dd>
          </div>
        ) : null}
        {item.notPerformedReason ? (
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.12em] text-tesText-muted">Motivo</dt>
            <dd className="mt-1 text-sm font-extrabold text-brand-deep">{formatFeedbackReason(item.notPerformedReason)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-tesText-muted">Enviado em</dt>
          <dd className="mt-1 text-sm font-extrabold text-brand-deep">{formatFeedbackDate(item.createdAt)}</dd>
        </div>
        {item.comment ? (
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.12em] text-tesText-muted">Observações</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-tesText-secondary">{item.comment}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

function feedbackRoleLabel(role: "patient" | "therapist") {
  return role === "patient" ? "o cliente" : "o terapeuta";
}

function formatFeedbackReason(reason: string) {
  const labels: Record<string, string> = {
    audio_video_problem: "Problema técnico de áudio ou vídeo",
    internet_problem: "Problema de internet",
    late_cancellation: "Cancelamento em cima da hora",
    other: "Outro motivo",
    patient_absent: "Cliente não apareceu",
    rescheduled: "Sessão remarcada",
    therapist_absent: "Terapeuta não apareceu",
  };
  return labels[reason] ?? "Outro motivo";
}

function formatFeedbackDate(value: string) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function productField(label: string, value?: string) {
  if (!value) return null;
  return { label, value };
}

function statItem(label: string, value?: string) {
  if (!value) return null;
  return { label, value };
}

function describeMeeting() {
  return "Online";
}

function formatPaymentLabel(value?: string) {
  const key = (value ?? "").trim().toLowerCase();

  if (!key) return "";

  const labels: Record<string, string> = {
    canceled: "Cancelado",
    failed: "Falhou",
    paid: "Pago",
    pending: "Pendente",
    refunded: "Reembolsado",
  };

  return labels[key] ?? formatStatusLabel(value);
}

function statusTone(status: string) {
  if (status === "Concluída" || status === "Confirmada")
    return "success" as const;
  if (status === "Cancelada") return "danger" as const;
  if (status === "Pagamento pendente") return "warning" as const;
  return "primary" as const;
}

function roomTone(status: string) {
  if (["Em andamento", "Pronta para iniciar"].includes(status))
    return "success" as const;
  if (["Cancelada", "Com problema"].includes(status)) return "danger" as const;
  if (status === "Encerrada") return "muted" as const;
  return "primary" as const;
}

function paymentTone(status: string) {
  if (["Pago", "Confirmado", "Concluída"].includes(status))
    return "success" as const;
  if (["Falhou", "Cancelado", "Reembolsado"].includes(status))
    return "danger" as const;
  return "warning" as const;
}

function isAbsenceMessage(value?: string) {
  return [
    "A sala online ainda não possui atividade registrada.",
    "Ainda sem registro operacional da sala online.",
  ].includes(value ?? "");
}
