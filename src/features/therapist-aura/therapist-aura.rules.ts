import { auraActionRoutes } from "./therapist-aura.routes";
import type {
  AuraActionRouteKey,
  AuraRuleRecommendation,
  AuraSampledRate,
  TherapistAuraMeta,
  TherapistAuraSignals,
} from "./therapist-aura.types";

type RuleInput = {
  dismissedKeys: Set<string>;
  meta: TherapistAuraMeta;
  signals: TherapistAuraSignals;
};

type RuleDefinition = {
  actionLabel: string;
  actionRouteKey: AuraActionRouteKey;
  body: (input: RuleInput) => string;
  evidenceLabel: (input: RuleInput) => string;
  priority: number;
  ruleKey: string;
  title: string;
  tone: AuraRuleRecommendation["tone"];
  when: (input: RuleInput) => boolean;
};

const ruleVersion = 1;

export const auraRules: RuleDefinition[] = [
  {
    actionLabel: "Revisar agenda",
    actionRouteKey: "agenda",
    body: ({ signals }) =>
      `Você tem ${signals.bookingReadiness.publicBookableServices} serviço(s) público(s) agendável(is), mas a Aura não encontrou horários livres nos próximos 14 dias.`,
    evidenceLabel: () => "Janela analisada: próximos 14 dias.",
    priority: 95,
    ruleKey: "aura.booking_readiness.no_future_slots.v1",
    title: "Sua agenda pública pode estar sem horários",
    tone: "attention",
    when: ({ signals }) =>
      signals.bookingReadiness.status === "ready" &&
      signals.bookingReadiness.publicBookableServices > 0 &&
      signals.bookingReadiness.servicesWithFutureAvailability === 0,
  },
  {
    actionLabel: "Responder avaliações",
    actionRouteKey: "reviews",
    body: ({ signals }) =>
      `Há ${signals.reviews.pendingReplyCount} avaliação(ões) publicada(s) sem resposta sua.`,
    evidenceLabel: () => "Somente avaliações publicadas foram consideradas.",
    priority: 90,
    ruleKey: "aura.reviews.pending_reply.v1",
    title: "Avaliações aguardam uma resposta",
    tone: "care",
    when: ({ signals }) =>
      signals.reviews.status === "ready" &&
      signals.reviews.pendingReplyCount > 0,
  },
  {
    actionLabel: "Ver sessões",
    actionRouteKey: "sessions",
    body: ({ meta, signals }) =>
      `A taxa de cancelamentos subiu de ${formatPercent(signals.sessions.cancellationRate.previousValue)} para ${formatPercent(signals.sessions.cancellationRate.value)} nos últimos ${meta.periodDays} dias completos.`,
    evidenceLabel: ({ meta, signals }) =>
      `Amostra: ${signals.sessions.cancellationRate.observedSample} sessões no período de ${meta.periodDays} dias completos.`,
    priority: 80,
    ruleKey: "aura.sessions.cancellation_increased.v1",
    title: "Cancelamentos aumentaram no período",
    tone: "attention",
    when: ({ signals }) =>
      worsenedRate(signals.sessions.cancellationRate, "up"),
  },
  {
    actionLabel: "Revisar sessões",
    actionRouteKey: "sessions",
    body: ({ signals }) =>
      `A taxa operacional de ausência subiu de ${formatPercent(signals.sessions.noShowRate.previousValue)} para ${formatPercent(signals.sessions.noShowRate.value)}.`,
    evidenceLabel: ({ meta, signals }) =>
      `Amostra: ${signals.sessions.noShowRate.observedSample} presenças/ausências no período de ${meta.periodDays} dias completos.`,
    priority: 75,
    ruleKey: "aura.sessions.no_show_increased.v1",
    title: "Ausências operacionais pedem atenção",
    tone: "care",
    when: ({ signals }) => worsenedRate(signals.sessions.noShowRate, "up"),
  },
  {
    actionLabel: "Ver continuidade",
    actionRouteKey: "insights",
    body: ({ signals }) =>
      `A taxa de retorno caiu de ${formatPercent(signals.continuity.returnRate.previousValue)} para ${formatPercent(signals.continuity.returnRate.value)}.`,
    evidenceLabel: ({ meta, signals }) =>
      `Amostra: ${signals.continuity.returnRate.observedSample} pessoas no período de ${meta.periodDays} dias completos.`,
    priority: 70,
    ruleKey: "aura.continuity.return_rate_decreased.v1",
    title: "Continuidade menor que no período anterior",
    tone: "opportunity",
    when: ({ signals }) => worsenedRate(signals.continuity.returnRate, "down"),
  },
];

export function buildAuraRecommendations({
  dismissals,
  meta,
  signals,
}: {
  dismissals: Array<{ recommendationKey: string }>;
  meta: TherapistAuraMeta;
  signals: TherapistAuraSignals;
}) {
  const input: RuleInput = {
    dismissedKeys: new Set(
      dismissals.map((dismissal) => dismissal.recommendationKey),
    ),
    meta,
    signals,
  };

  return auraRules
    .filter((rule) => rule.when(input))
    .map((rule) => {
      const id = buildAuraRecommendationKey(rule.ruleKey, meta);
      return {
        actionHref: auraActionRoutes[rule.actionRouteKey],
        actionLabel: rule.actionLabel,
        actionRouteKey: rule.actionRouteKey,
        body: rule.body(input),
        evidenceLabel: rule.evidenceLabel(input),
        id,
        priority: rule.priority,
        ruleKey: rule.ruleKey,
        ruleVersion,
        title: rule.title,
        tone: rule.tone,
      } satisfies AuraRuleRecommendation;
    })
    .filter((recommendation) => !input.dismissedKeys.has(recommendation.id))
    .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title));
}

export function buildAuraRecommendationKey(
  ruleKey: string,
  meta: Pick<TherapistAuraMeta, "periodEnd" | "periodStart">,
) {
  return `${ruleKey}:${meta.periodStart}:${meta.periodEnd}`;
}

function worsenedRate(metric: AuraSampledRate, worseDirection: "down" | "up") {
  return (
    metric.status === "ready" &&
    metric.direction === worseDirection &&
    metric.value !== null &&
    metric.previousValue !== null &&
    metric.value !== metric.previousValue
  );
}

function formatPercent(value: number | null) {
  if (value === null) return "sem base comparável";
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value)}%`;
}
