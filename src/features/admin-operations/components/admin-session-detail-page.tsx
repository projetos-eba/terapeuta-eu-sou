import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageMain,
} from "@/components/app-page";
import { routes } from "@/lib/routes";

import type { AdminOperationDetailPageData } from "../admin-operations.types";
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
    productField("Cliente", participantFields.get("Cliente")),
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
              productField("Cliente", participantFields.get("Cliente")),
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
