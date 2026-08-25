import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CalendarCheck2,
  Clock3,
  Eye,
  Info,
  RefreshCw,
  Sparkles,
  Star,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { AppPageContainer, AppPageSection } from "@/components/app-page";
import { TESCard } from "@/components/tes";
import { TherapistPlan } from "@/domain/tes";
import { TherapistLockedCard } from "@/features/therapist-access";
import { routes } from "@/lib/routes";

import { getTherapistMetricCopy } from "../therapist-metrics.copy";
import type {
  TherapistInterestMetrics,
  TherapistInterestMetricsReady,
  TherapistMetricCounter,
  TherapistMetricsDashboard,
  TherapistMetricsDashboardView,
  TherapistMetricsOverview,
} from "../therapist-metrics.types";
import {
  DistributionDonut,
  type MetricChartTone,
  MetricSparkline,
  MetricsFunnel,
  MetricsHeatmap,
  SessionsEvolutionChart,
} from "./therapist-metrics-charts";
import { formatMetricValue } from "./therapist-metric-card";
import { TherapistMetricsLayout } from "./therapist-metrics-layout";

export function TherapistMetricsPage({
  data,
}: {
  data: TherapistMetricsDashboard | TherapistMetricsDashboardView;
}) {
  const { overview, sessions, occupancy, interest } = data;
  const sessionComparison =
    "sessionEvolutionComparison" in data
      ? data.sessionEvolutionComparison
      : {
          meta: data.meta,
          points: overview.activity.points.map((point, index) => ({
            current: point.sessionsCompleted,
            currentDate: point.date,
            index,
            previous: 0,
            previousDate: point.date,
          })),
          status: overview.activity.status,
        };
  const sparkline = aggregateSparklineToThree(
    overview.activity.points.map((point) => ({
      label: point.date,
      value: point.sessionsCompleted,
    })),
  );
  const occupancySparkline =
    occupancy.status === "ready"
      ? aggregateOccupancyToThree(occupancy.series)
      : [];
  const comparisonPoints = sessionComparison.points.map((point) => ({
    date: point.currentDate,
    previous: point.previous,
    previousDate: point.previousDate,
    sessionsCompleted: point.current,
  }));
  const currentPeriodLabel = `Atual · ${formatPeriodRange(
    sessionComparison.meta.periodStart,
    sessionComparison.meta.periodEnd,
  )}`;
  const previousPeriodLabel = `Anterior · ${formatPeriodRange(
    sessionComparison.meta.previousPeriodStart,
    sessionComparison.meta.previousPeriodEnd,
  )}`;
  const interestData = isInterestReady(interest) ? interest : null;
  const returnRate = interestData?.summary.returnRate ?? null;
  const topTherapy = overview.therapyRanking.items[0];
  const profileViews = discoveryKpi(
    overview.discovery.status,
    overview.discovery.stages.profileViews,
  );
  const bookingStarts = discoveryKpi(
    overview.discovery.status,
    overview.discovery.stages.bookingFlowStarts,
  );
  const returnRateKpi =
    returnRate?.status === "ready" && returnRate.value !== null
      ? {
          copy: "Pessoas que realizaram mais de uma sessão",
          state: "ready" as const,
          value: `${formatNumber(returnRate.value)}%`,
        }
      : {
          copy: "Disponível no Premium Plus quando houver dados suficientes",
          state: "unavailable" as const,
          value: "—",
        };
  const occupancyKpi =
    occupancy.status === "ready"
      ? {
          copy: "Minutos ocupados sobre a capacidade ofertada",
          state:
            occupancy.current.percentage === null
              ? ("empty" as const)
              : ("ready" as const),
          value:
            occupancy.current.percentage === null
              ? "Sem base"
              : `${formatNumber(occupancy.current.percentage)}%`,
        }
      : occupancy.status === "empty"
        ? {
            copy: "Não houve capacidade ofertada neste período",
            state: "empty" as const,
            value: "Sem base",
          }
        : {
            copy: "A leitura aparece quando houver cobertura confiável",
            state: "forming" as const,
            value: "—",
          };
  const therapyKpi =
    overview.therapyRanking.status === "ready" && topTherapy
      ? {
          copy: `${formatNumber(topTherapy.counter.value)} sessões concluídas no período`,
          state: "ready" as const,
          value: topTherapy.therapyName,
        }
      : {
          copy: "Aparece quando houver dados suficientes para preservar a privacidade",
          state: "unavailable" as const,
          value: "—",
        };
  const comparisonItems = [
    comparisonReference(
      "Visualizações do perfil",
      overview.discovery.status === "ready"
        ? overview.discovery.stages.profileViews
        : null,
      "Coleta pública ainda não está ativa",
    ),
    comparisonReference(
      "Interessados em agendar",
      overview.discovery.status === "ready"
        ? overview.discovery.stages.bookingFlowStarts
        : null,
      "Coleta pública ainda não está ativa",
    ),
    comparisonCounter(
      "Sessões realizadas",
      overview.counters.sessionsCompleted,
    ),
    returnRate?.status === "ready" && returnRate.value !== null
      ? comparisonSampled(
          "Taxa de retorno",
          returnRate.value,
          returnRate.previousValue,
        )
      : comparisonReference(
          "Taxa de retorno",
          null,
          "Disponível com dados suficientes no Premium Plus",
        ),
    occupancy.status === "ready" && occupancy.current.percentage !== null
      ? comparisonSampled(
          "Ocupação da agenda",
          occupancy.current.percentage,
          occupancy.previous.percentage,
          "%",
        )
      : comparisonReference(
          "Ocupação da agenda",
          null,
          "Histórico da agenda em formação",
        ),
  ];
  const hasAnyActivity = dashboardHasActivity(data);

  return (
    <TherapistMetricsLayout meta={data.meta} tab="overview">
      <section aria-labelledby="metrics-overview-title">
        <h2 className="sr-only" id="metrics-overview-title">
          Visão geral do acompanhamento
        </h2>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <MetricsKpiCard
            copy={profileViews.copy}
            icon={Eye}
            label="Visualizações do perfil"
            sparkline={[]}
            state={profileViews.state}
            tone="primary"
            value={profileViews.value}
          />
          <MetricsKpiCard
            copy={bookingStarts.copy}
            icon={CalendarCheck2}
            label="Interessados em agendar"
            sparkline={[]}
            state={bookingStarts.state}
            tone="mint"
            value={bookingStarts.value}
          />
          <MetricsKpiCard
            copy={getTherapistMetricCopy(
              overview.counters.sessionsCompleted.directionCopyKey,
            )}
            icon={CalendarCheck2}
            label="Sessões realizadas"
            sparkline={sparkline}
            tone="cyan"
            value={formatMetricValue(
              overview.counters.sessionsCompleted.value,
              "sessions",
            )}
          />
          {data.therapist.plan === TherapistPlan.Premium ? (
            <TherapistLockedCard
              description="Acompanhe a continuidade do cuidado e os sinais de retorno quando essa leitura fizer sentido para você."
              requiredPlan={TherapistPlan.PremiumPlus}
              title="Taxa de retorno"
              variant="compact"
            />
          ) : (
            <MetricsKpiCard
              copy={returnRateKpi.copy}
              icon={RefreshCw}
              label="Taxa de retorno"
              sparkline={[]}
              state={returnRateKpi.state}
              tone="warning"
              value={returnRateKpi.value}
            />
          )}
          <MetricsKpiCard
            copy={occupancyKpi.copy}
            icon={Clock3}
            label="Ocupação da agenda"
            sparkline={occupancySparkline}
            state={occupancyKpi.state}
            tone="primary"
            value={occupancyKpi.value}
          />
          <MetricsKpiCard
            copy={therapyKpi.copy}
            icon={Sparkles}
            label="Terapia mais realizada"
            sparkline={sparkline}
            state={therapyKpi.state}
            tone="danger"
            value={therapyKpi.value}
          />
        </div>
        <p className="mt-3 rounded-card border border-brand-cyan/20 bg-gradient-to-r from-brand-cyanSoft via-white to-status-successBg/60 px-4 py-3 text-sm font-semibold leading-5 text-tesText-secondary">
          {hasAnyActivity
            ? "Os indicadores usam somente períodos completos e dados agregados do seu próprio trabalho."
            : "Seus indicadores começam a ser preenchidos conforme o perfil recebe movimento, a agenda é utilizada e as sessões são concluídas."}
        </p>
      </section>

      <MetricsAgendaSummary data={data} />

      <div className="grid gap-5 lg:grid-cols-2">
        <MetricPanel
          description="A jornada agregada desde a visualização do perfil até a sessão concluída."
          icon={Eye}
          title="Funil de conversão"
          tone="primary"
        >
          <MetricsFunnel
            stages={[
              {
                label: "Visualizaram o perfil",
                value:
                  overview.discovery.status === "ready"
                    ? overview.discovery.stages.profileViews.value
                    : 0,
              },
              {
                label: "Iniciaram o agendamento",
                value:
                  overview.discovery.status === "ready"
                    ? overview.discovery.stages.bookingFlowStarts.value
                    : 0,
              },
              {
                label: "Sessões concluídas",
                value:
                  overview.discovery.status === "ready"
                    ? overview.counters.sessionsCompleted.value
                    : 0,
              },
            ]}
          />
          {overview.discovery.status !== "ready" ? (
            <MetricsVisualFootnote>
              A estrutura do funil está pronta. Os números de descoberta só
              aparecem após a ativação formal e segura dessa coleta.
            </MetricsVisualFootnote>
          ) : null}
        </MetricPanel>

        <MetricPanel
          description={`Sessões concluídas nos últimos ${data.meta.periodDays} dias completos, sem incluir o dia atual.`}
          icon={CalendarCheck2}
          title="Evolução das sessões"
          tone="cyan"
        >
          <SessionsEvolutionChart
            currentPeriodLabel={currentPeriodLabel}
            empty={sessionComparison.status === "empty"}
            points={comparisonPoints}
            previousPeriodLabel={previousPeriodLabel}
          />
        </MetricPanel>
      </div>

      {hasAnyActivity ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
          <MetricPanel
            description="Grupos de continuidade são mostrados separadamente e não formam uma distribuição única."
            icon={UsersRound}
            title="Pessoas acompanhadas"
            tone="mint"
          >
            <PatientContinuityCards
              interest={interestData}
              peopleServed={overview.counters.peopleServed}
              plan={data.therapist.plan}
            />
          </MetricPanel>

          <MetricPanel
            description="Terapias com mais sessões concluídas no período. Esta leitura não representa procura."
            icon={Star}
            title="Top terapias"
            tone="warning"
          >
            <TherapyRankingTable
              empty={sessions.therapyDistribution.status !== "ready"}
              items={sessions.therapyDistribution.items}
            />
          </MetricPanel>
        </div>
      ) : (
        <MetricsPreviewGrid />
      )}

      {hasAnyActivity ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <MetricPanel
            description="Comparação com o seu próprio período anterior, sem benchmark entre profissionais."
            icon={RefreshCw}
            title="Comparativo com o período anterior"
            tone="cyan"
          >
            {data.therapist.plan === TherapistPlan.Premium ? (
              <TherapistLockedCard
                description="Compare seus períodos e encontre leituras adicionais da sua prática quando estiver pronto para esse próximo passo."
                requiredPlan={TherapistPlan.PremiumPlus}
                title="Leituras comparativas"
                variant="section"
              />
            ) : (
              <MetricsComparison items={comparisonItems} />
            )}
          </MetricPanel>

          <MetricPanel
            description="Situação final registrada para as sessões do período."
            icon={CalendarCheck2}
            title="Resultados das sessões"
            tone="danger"
          >
            <DistributionDonut
              centerLabel={`${sessions.outcomeDistribution.observedSample} sessões`}
              empty={sessions.outcomeDistribution.status !== "ready"}
              emptyMessage="A composição aparece quando houver base suficiente para preservar a privacidade."
              items={sessions.outcomeDistribution.items.map((item) => ({
                label: item.label,
                value: item.value,
              }))}
              label="Distribuição dos resultados das sessões"
            />
          </MetricPanel>
        </div>
      ) : null}

      <AppPageSection className="grid gap-4 border-brand-lavender/80 bg-gradient-to-r from-brand-lavenderSoft/70 to-surface-soft/60 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
        <Info className="text-brand-primary" size={24} />
        <div>
          <h2 className="text-lg font-extrabold text-brand-deep">
            Como interpretar este painel
          </h2>
          <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-tesText-secondary">
            Observe tendências ao longo do tempo, use a ocupação para organizar
            sua disponibilidade e acompanhe a continuidade sem comparar seu
            trabalho ao de outros profissionais.
          </p>
          <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-tesText-secondary">
            O dia atual fica de fora para evitar comparações incompletas. Alguns
            dados só aparecem com pelo menos dez registros e a ocupação exige
            histórico completo da agenda.
          </p>
        </div>
      </AppPageSection>
    </TherapistMetricsLayout>
  );
}

const metricToneStyles: Record<
  MetricChartTone,
  {
    accent: string;
    glow: string;
    icon: string;
    line: string;
    panel: string;
    pill: string;
    surface: string;
  }
> = {
  cyan: {
    accent: "before:bg-brand-cyan",
    glow: "bg-brand-cyan/25",
    icon: "bg-brand-cyanSoft text-brand-cyan",
    line: "bg-brand-cyan",
    panel:
      "bg-[radial-gradient(circle_at_92%_0%,var(--tes-color-brand-cyan-soft)_0%,transparent_38%),linear-gradient(180deg,var(--tes-color-surface-default)_0%,var(--tes-color-surface-default)_100%)]",
    pill: "bg-brand-cyanSoft text-status-info",
    surface: "from-brand-cyanSoft/70",
  },
  danger: {
    accent: "before:bg-status-danger",
    glow: "bg-status-danger/15",
    icon: "bg-status-dangerBg text-status-danger",
    line: "bg-status-danger",
    panel:
      "bg-[radial-gradient(circle_at_92%_0%,var(--tes-color-status-danger-bg)_0%,transparent_38%),linear-gradient(180deg,var(--tes-color-surface-default)_0%,var(--tes-color-surface-default)_100%)]",
    pill: "bg-status-dangerBg text-status-danger",
    surface: "from-status-dangerBg/55",
  },
  mint: {
    accent: "before:bg-status-success",
    glow: "bg-brand-mint/35",
    icon: "bg-status-successBg text-status-success",
    line: "bg-status-success",
    panel:
      "bg-[radial-gradient(circle_at_92%_0%,var(--tes-color-status-success-bg)_0%,transparent_38%),linear-gradient(180deg,var(--tes-color-surface-default)_0%,var(--tes-color-surface-default)_100%)]",
    pill: "bg-status-successBg text-status-success",
    surface: "from-status-successBg/65",
  },
  primary: {
    accent: "before:bg-brand-primary",
    glow: "bg-brand-lavender/45",
    icon: "bg-brand-lavenderSoft text-brand-primary",
    line: "bg-brand-primary",
    panel:
      "bg-[radial-gradient(circle_at_92%_0%,var(--tes-color-brand-lavender-soft)_0%,transparent_40%),linear-gradient(180deg,var(--tes-color-surface-default)_0%,var(--tes-color-surface-default)_100%)]",
    pill: "bg-brand-lavenderSoft text-brand-primary",
    surface: "from-brand-lavenderSoft/65",
  },
  warning: {
    accent: "before:bg-status-warning",
    glow: "bg-status-warning/15",
    icon: "bg-status-warningBg text-status-warning",
    line: "bg-status-warning",
    panel:
      "bg-[radial-gradient(circle_at_92%_0%,var(--tes-color-status-warning-bg)_0%,transparent_38%),linear-gradient(180deg,var(--tes-color-surface-default)_0%,var(--tes-color-surface-default)_100%)]",
    pill: "bg-status-warningBg text-status-warning",
    surface: "from-status-warningBg/60",
  },
};

function MetricsKpiCard({
  copy,
  icon: Icon,
  label,
  sparkline,
  state = "ready",
  tone = "primary",
  value,
}: {
  copy: string;
  icon: LucideIcon;
  label: string;
  sparkline: Array<{ label: string; value: number }>;
  state?: "empty" | "forming" | "ready" | "unavailable";
  tone?: MetricChartTone;
  value: string;
}) {
  const isUnavailable = state === "unavailable";
  const isReference = value === "—";
  const stateLabel = {
    empty: "Sem base",
    forming: "Em formação",
    ready: null,
    unavailable: "Indisponível",
  }[state];
  const toneStyles = metricToneStyles[tone];

  return (
    <TESCard
      as="article"
      className={`relative flex min-h-[174px] min-w-0 flex-col overflow-hidden border-brand-lavender/70 bg-gradient-to-b ${toneStyles.surface} via-white to-white p-3 shadow-[0_14px_34px_rgba(57,45,90,0.07)] before:absolute before:inset-x-5 before:top-0 before:h-[3px] before:rounded-b-full sm:min-h-[214px] sm:p-5 ${toneStyles.accent}`}
      data-tone={tone}
    >
      <div className="flex min-h-11 items-start gap-2.5">
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-[13px] ${toneStyles.icon}`}
        >
          <Icon aria-hidden="true" size={18} />
        </span>
        <h3 className="text-sm font-extrabold leading-5 text-brand-deep">
          {label}
        </h3>
      </div>
      <p
        className={`mt-5 font-extrabold leading-tight text-brand-deep ${
          isReference
            ? "text-[32px] leading-none sm:text-[36px]"
            : isUnavailable
              ? "whitespace-nowrap text-[22px] sm:text-[24px]"
              : "break-words text-[24px] sm:text-[28px]"
        }`}
      >
        {value}
      </p>
      {stateLabel ? (
        <span
          className={`mt-2 inline-flex min-h-7 w-fit items-center rounded-full px-2.5 text-xs font-extrabold ${toneStyles.pill}`}
        >
          {stateLabel}
        </span>
      ) : null}
      <p className="mt-2 min-h-8 text-sm font-semibold leading-5 text-tesText-secondary sm:min-h-10">
        {copy}
      </p>
      <div className="mt-auto pt-3">
        <MetricSparkline
          className="h-9"
          data={sparkline}
          empty={state !== "ready" || sparkline.length < 2}
          label={`Tendência de ${label}`}
          tone={tone}
        />
      </div>
    </TESCard>
  );
}

export function aggregateSparklineToThree(
  points: Array<{ label: string; value: number }>,
) {
  return aggregateToThree(points, (group) =>
    group.reduce((total, point) => total + point.value, 0),
  );
}

function aggregateOccupancyToThree(
  points: Array<{
    date: string;
    occupiedMinutes: number;
    offeredMinutes: number;
  }>,
) {
  return aggregateToThree(
    points.map((point) => ({
      label: point.date,
      occupiedMinutes: point.occupiedMinutes,
      offeredMinutes: point.offeredMinutes,
      value: 0,
    })),
    (group) => {
      const offered = group.reduce(
        (total, point) => total + point.offeredMinutes,
        0,
      );
      const occupied = group.reduce(
        (total, point) => total + point.occupiedMinutes,
        0,
      );
      return offered === 0 ? 0 : (occupied / offered) * 100;
    },
  );
}

function aggregateToThree<T extends { label: string; value: number }>(
  points: T[],
  value: (group: T[]) => number,
) {
  if (points.length === 0) return [];
  const groups = Math.min(3, points.length);
  return Array.from({ length: groups }, (_, index) => {
    const start = Math.floor((index * points.length) / groups);
    const end = Math.floor(((index + 1) * points.length) / groups);
    const group = points.slice(start, end);
    return {
      label:
        group.length === 1
          ? group[0].label
          : `${group[0].label}–${group[group.length - 1].label}`,
      value: value(group),
    };
  });
}

function MetricsAgendaSummary({ data }: { data: TherapistMetricsDashboard }) {
  const { occupancy, sessions } = data;
  const heatmapPoints =
    sessions.heatmap.status === "ready"
      ? sessions.heatmap.items.map((point) => ({
          ...point,
          value: point.sessions,
        }))
      : [];
  const highlights = agendaHighlights(heatmapPoints);
  const occupancyPercentage =
    occupancy.status === "ready" &&
    occupancy.current.percentage !== null &&
    occupancy.current.offeredMinutes > 0
      ? occupancy.current.percentage
      : null;
  const occupancyReady = occupancyPercentage !== null;

  return (
    <AppPageSection className="min-w-0 overflow-hidden border-brand-cyan/25 bg-gradient-to-br from-white via-white to-brand-cyanSoft/55 p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-brand-cyanSoft text-status-info">
            <Clock3 aria-hidden="true" size={21} />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-brand-deep sm:text-xl">
              Agenda e horários
            </h2>
            <p className="mt-1 text-sm font-semibold leading-5 text-tesText-secondary">
              Entenda como sua disponibilidade está sendo utilizada e em quais
              horários as sessões se concentram.
            </p>
          </div>
        </div>
        <Link
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={routes.therapist.agenda}
        >
          Gerenciar agenda
          <ArrowRight aria-hidden="true" size={17} />
        </Link>
      </div>

      <div className="grid divide-y divide-brand-lavender/70 lg:grid-cols-[minmax(220px,0.72fr)_minmax(0,1.35fr)_minmax(210px,0.72fr)] lg:divide-x lg:divide-y-0">
        <div className="min-w-0 py-4 lg:py-0 lg:pr-6">
          <p className="text-sm font-extrabold text-brand-deep">
            Ocupação da agenda
          </p>
          <DistributionDonut
            centerLabel={`${formatNumber(occupancyPercentage ?? 0)}%`}
            compact
            empty={!occupancyReady}
            emptyMessage={
              occupancy.status === "forming"
                ? `Histórico em formação: ${occupancy.coverageDays} de ${occupancy.requiredCoverageDays} dias cobertos.`
                : "Publique horários e receba agendamentos para formar esta leitura."
            }
            items={
              occupancyPercentage === null
                ? []
                : [
                    { label: "Ocupado", value: occupancyPercentage },
                    {
                      label: "Disponível",
                      value: Math.max(0, 100 - occupancyPercentage),
                    },
                  ]
            }
            label="Ocupação da agenda"
            palette="occupancy"
            valueSuffix="%"
          />
        </div>

        <div className="min-w-0 py-5 lg:px-6 lg:py-0">
          <p className="mb-3 text-sm font-extrabold text-brand-deep">
            Intensidade das sessões por dia e horário
          </p>
          <MetricsHeatmap
            emptyMessage="A grade será preenchida conforme as sessões forem concluídas no período."
            points={heatmapPoints}
            valueLabel="sessões"
          />
        </div>

        <div className="min-w-0 py-4 lg:py-0 lg:pl-6">
          <p className="text-sm font-extrabold text-brand-deep">
            Leitura do período
          </p>
          <dl className="mt-4 grid gap-4">
            <AgendaStat
              label="Sessões concluídas"
              tone="cyan"
              value={formatMetricValue(
                data.overview.counters.sessionsCompleted.value,
                "sessions",
              )}
            />
            <AgendaStat
              label="Melhores dias"
              tone="mint"
              value={highlights.bestDays}
            />
            <AgendaStat
              label="Horários de pico"
              tone="warning"
              value={highlights.peakHour}
            />
            <AgendaStat
              label="Horários ociosos"
              tone="primary"
              value={highlights.quietHour}
            />
          </dl>
        </div>
      </div>
    </AppPageSection>
  );
}

function AgendaStat({
  label,
  tone,
  value,
}: {
  label: string;
  tone: MetricChartTone;
  value: string;
}) {
  const toneStyles = metricToneStyles[tone];
  return (
    <div className="flex items-center gap-3 rounded-card bg-white/80 p-2.5 shadow-[0_8px_20px_rgba(57,45,90,0.05)]">
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${toneStyles.icon}`}
      >
        •
      </span>
      <div className="min-w-0">
        <dt className="text-sm font-bold text-tesText-secondary">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-extrabold text-brand-deep">
          {value}
        </dd>
      </div>
    </div>
  );
}

function MetricsPreviewGrid() {
  const previews = [
    {
      copy: "Acompanhe o volume de sessões ao longo dos períodos.",
      icon: CalendarCheck2,
      title: "Evolução das sessões",
      tone: "cyan" as const,
    },
    {
      copy: "Veja quais terapias concentram as sessões concluídas.",
      icon: Star,
      title: "Top terapias",
      tone: "warning" as const,
    },
    {
      copy: "Compare o período selecionado com o período anterior.",
      icon: RefreshCw,
      title: "Comparativo de períodos",
      tone: "primary" as const,
    },
    {
      copy: "Entenda a composição dos resultados registrados.",
      icon: UsersRound,
      title: "Resultados das sessões",
      tone: "mint" as const,
    },
  ];

  return (
    <section aria-labelledby="metrics-preview-title">
      <div className="mb-4">
        <h2
          className="font-display text-[30px] font-light italic leading-tight text-brand-deep sm:text-[36px]"
          id="metrics-preview-title"
        >
          O que aparecerá com seu histórico
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          As análises abaixo ganham forma sem dados de exemplo, conforme o seu
          movimento real aumenta.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {previews.map(({ copy, icon: Icon, title, tone }) => {
          const toneStyles = metricToneStyles[tone];
          return (
            <TESCard
              as="article"
              className={`relative min-w-0 overflow-hidden border-brand-lavender/60 bg-gradient-to-b ${toneStyles.surface} to-white p-4 before:absolute before:inset-x-4 before:top-0 before:h-[3px] before:rounded-b-full ${toneStyles.accent}`}
              key={title}
            >
              <span
                className={`grid size-9 place-items-center rounded-[13px] ${toneStyles.icon}`}
              >
                <Icon aria-hidden="true" size={19} />
              </span>
              <h3 className="mt-4 text-sm font-extrabold text-brand-deep">
                {title}
              </h3>
              <p className="mt-2 text-xs font-semibold leading-5 text-tesText-secondary">
                {copy}
              </p>
              <span
                className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ${toneStyles.pill}`}
              >
                Em formação
              </span>
            </TESCard>
          );
        })}
      </div>
    </section>
  );
}

function TherapyRankingTable({
  empty = false,
  items,
}: {
  empty?: boolean;
  items: Array<{
    percentage: number;
    sessions: number;
    therapyId: string;
    therapyName: string;
  }>;
}) {
  const maximum = Math.max(1, ...items.map((item) => item.sessions));
  const visualItems =
    empty || items.length === 0
      ? Array.from({ length: 3 }, (_, index) => ({
          percentage: 0,
          sessions: 0,
          therapyId: `reference-${index + 1}`,
          therapyName: index === 0 ? "Aguardando sessões" : "Sem dados ainda",
        }))
      : items.slice(0, 6);
  const rankingTones = [
    {
      bar: "bg-brand-primary",
      rank: "bg-brand-lavenderSoft text-brand-primary",
    },
    {
      bar: "bg-status-warning",
      rank: "bg-status-warningBg text-status-warning",
    },
    {
      bar: "bg-status-success",
      rank: "bg-status-successBg text-status-success",
    },
    {
      bar: "bg-status-danger",
      rank: "bg-status-dangerBg text-status-danger",
    },
    {
      bar: "bg-brand-cyan",
      rank: "bg-brand-cyanSoft text-status-info",
    },
  ];
  return (
    <div className="grid gap-3">
      <ol aria-label="Ranking de terapias realizadas" className="grid gap-3">
        {visualItems.map((item, index) => {
          const tone = rankingTones[index % rankingTones.length];
          return (
            <li
              className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3"
              key={item.therapyId}
            >
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-extrabold ${tone.rank}`}
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-extrabold text-brand-deep">
                    {item.therapyName}
                  </span>
                  <span className="shrink-0 text-sm font-extrabold text-brand-deep">
                    {formatNumber(item.sessions)}
                  </span>
                </div>
                <span className="mt-2 block h-2 overflow-hidden rounded-full bg-brand-lavenderSoft">
                  <span
                    aria-hidden="true"
                    className={`block h-full rounded-full ${
                      empty ? "bg-brand-lavender" : tone.bar
                    }`}
                    style={{
                      width: empty
                        ? `${100 - index * 18}%`
                        : `${Math.max(6, (item.sessions / maximum) * 100)}%`,
                    }}
                  />
                </span>
              </div>
              <span className="text-xs font-bold text-tesText-muted">
                sessões
              </span>
            </li>
          );
        })}
      </ol>
      {empty ? (
        <MetricsVisualFootnote>
          As terapias aparecem aqui quando houver sessões concluídas suficientes
          para preservar a privacidade.
        </MetricsVisualFootnote>
      ) : null}
    </div>
  );
}

function MetricsComparison({ items }: { items: MetricsComparisonItem[] }) {
  const tones: MetricChartTone[] = [
    "primary",
    "mint",
    "cyan",
    "warning",
    "danger",
  ];
  return (
    <div
      aria-label="Comparativo de métricas"
      className="grid gap-2"
      role="list"
    >
      <div
        aria-hidden="true"
        className="flex items-center justify-end gap-4 text-[11px] font-bold text-tesText-muted"
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-brand-primary" /> Período
          atual
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed border-brand-lavender" />{" "}
          Período anterior
        </span>
      </div>
      {items.map((item, index) => (
        <div
          className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-brand-lavender/60 py-2 last:border-b-0"
          key={item.label}
          role="listitem"
        >
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-brand-deep">
              {item.label}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-tesText-secondary">
              {item.reference
                ? item.note
                : `Atual: ${item.currentLabel} · Anterior: ${item.previousLabel}`}
            </p>
          </div>
          <div className="grid min-w-[102px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:min-w-[160px]">
            <MetricSparkline
              className="h-8"
              data={item.sparkline}
              empty={item.reference}
              label={`Tendência de ${item.label}`}
              tone={tones[index % tones.length]}
            />
            <span
              className={`text-xs font-extrabold ${comparisonDeltaStyle(item)}`}
            >
              {item.reference ? "—" : item.deltaLabel}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function comparisonDeltaStyle(item: MetricsComparisonItem) {
  if (item.reference || item.deltaLabel === "Estável") {
    return "text-tesText-muted";
  }
  if (item.deltaLabel.startsWith("−")) return "text-status-danger";
  return "text-status-success";
}

function MetricPanel({
  children,
  className = "",
  description,
  icon: Icon,
  title,
  tone = "primary",
}: {
  children: React.ReactNode;
  className?: string;
  description: string;
  icon: LucideIcon;
  title: string;
  tone?: MetricChartTone;
}) {
  const toneStyles = metricToneStyles[tone];
  return (
    <AppPageSection
      className={`relative min-w-0 overflow-hidden border-brand-lavender/65 p-4 shadow-[0_14px_34px_rgba(57,45,90,0.06)] sm:p-5 ${toneStyles.panel} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-12 -top-16 size-40 rounded-[38%_62%_56%_44%] opacity-70 blur-3xl ${toneStyles.glow}`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute right-5 top-0 h-1 w-24 rounded-b-full opacity-80 ${toneStyles.line}`}
      />
      <div className="relative z-[1] mb-4 flex items-start gap-3">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-[14px] ${toneStyles.icon}`}
        >
          <Icon aria-hidden="true" size={21} />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-brand-deep sm:text-xl">
            {title}
          </h2>
          <p className="mt-1 text-sm font-semibold leading-5 text-tesText-secondary">
            {description}
          </p>
        </div>
      </div>
      <div className="relative z-[1]">{children}</div>
    </AppPageSection>
  );
}

function PatientContinuityCards({
  interest,
  peopleServed,
  plan,
}: {
  interest: TherapistInterestMetricsReady | null;
  peopleServed: TherapistMetricCounter<"people">;
  plan: TherapistPlan;
}) {
  if (plan === TherapistPlan.Premium) {
    return (
      <TherapistLockedCard
        description="Uma visão de continuidade ajuda a acompanhar os caminhos das pessoas sem expor dados individuais."
        requiredPlan={TherapistPlan.PremiumPlus}
        title="Continuidade e relacionamento"
        variant="section"
      />
    );
  }

  const keys = ["active", "new", "recurring", "inactive"] as const;
  const items = keys.map((key) => ({
    key,
    label: segmentLabel(key),
    value:
      interest?.segments.status === "ready"
        ? (interest.segments.items.find((item) => item.key === key)?.value ?? 0)
        : 0,
  }));
  const hasData = interest?.segments.status === "ready";
  const continuityTones = {
    active: metricToneStyles.primary,
    inactive: metricToneStyles.danger,
    new: metricToneStyles.mint,
    recurring: metricToneStyles.warning,
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
        <div className="rounded-card bg-gradient-to-b from-status-successBg/70 to-white p-2">
          <DistributionDonut
            centerLabel={`${formatNumber(peopleServed.value)} pessoas`}
            compact
            empty={peopleServed.status !== "ready"}
            emptyMessage="O total aparecerá quando houver pessoas acompanhadas no período."
            items={[
              {
                label: "Pessoas acompanhadas",
                value: peopleServed.value,
              },
            ]}
            label="Total de pessoas acompanhadas no período"
            palette="continuity"
            showLegend={false}
          />
          <p className="px-2 pb-2 text-center text-xs font-bold leading-4 text-tesText-secondary">
            Total único no período
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {items.map((item) => {
            const tone = continuityTones[item.key];
            return (
              <div
                className={`relative overflow-hidden rounded-card border border-brand-lavender/55 bg-gradient-to-b ${tone.surface} to-white p-3 before:absolute before:inset-x-3 before:top-0 before:h-[3px] before:rounded-b-full ${tone.accent}`}
                key={item.key}
              >
                <span
                  aria-hidden="true"
                  className={`mb-3 block size-7 rounded-full ${tone.icon}`}
                />
                <p className="text-xs font-bold text-tesText-secondary">
                  {item.label}
                </p>
                <p className="mt-1 text-xl font-extrabold text-brand-deep">
                  {formatNumber(item.value)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
      {!hasData ? (
        <MetricsVisualFootnote>
          Os cartões serão preenchidos quando houver dados de continuidade
          suficientes para esta leitura.
        </MetricsVisualFootnote>
      ) : null}
    </div>
  );
}

function MetricsVisualFootnote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-card bg-surface-soft px-3 py-2 text-sm font-semibold leading-5 text-tesText-secondary">
      {children}
    </p>
  );
}

type MetricsComparisonItem = {
  currentLabel: string;
  deltaLabel: string;
  label: string;
  note?: string;
  previousLabel: string;
  reference: boolean;
  sparkline: Array<{ label: string; value: number }>;
};

function comparisonCounter<
  TUnit extends "events" | "minutes" | "people" | "sessions",
>(label: string, metric: TherapistMetricCounter<TUnit>): MetricsComparisonItem {
  const delta = metric.value - metric.previousValue;
  return {
    currentLabel: formatMetricValue(metric.value, metric.unit),
    deltaLabel:
      delta === 0
        ? "Estável"
        : `${delta > 0 ? "+" : "−"}${formatMetricValue(Math.abs(delta), metric.unit)}`,
    label,
    previousLabel: formatMetricValue(metric.previousValue, metric.unit),
    reference: false,
    sparkline: [
      { label: "Anterior", value: metric.previousValue },
      { label: "Atual", value: metric.value },
    ],
  };
}

function comparisonReference(
  label: string,
  metric: TherapistMetricCounter<"events"> | null,
  note: string,
): MetricsComparisonItem {
  return metric
    ? comparisonCounter(label, metric)
    : emptyComparison(label, note);
}

function comparisonSampled(
  label: string,
  currentValue: number,
  previousValue: number | null,
  suffix = "%",
): MetricsComparisonItem {
  const previous = previousValue ?? 0;
  const delta = currentValue - previous;
  return {
    currentLabel: `${formatNumber(currentValue)}${suffix}`,
    deltaLabel:
      previousValue === null
        ? "Novo"
        : delta === 0
          ? "Estável"
          : `${delta > 0 ? "+" : "−"}${formatNumber(Math.abs(delta))}${suffix}`,
    label,
    previousLabel:
      previousValue === null
        ? "Sem comparação"
        : `${formatNumber(previous)}${suffix}`,
    reference: false,
    sparkline: [
      { label: "Anterior", value: previous },
      { label: "Atual", value: currentValue },
    ],
  };
}

function emptyComparison(label: string, note: string): MetricsComparisonItem {
  return {
    currentLabel: "—",
    deltaLabel: "—",
    label,
    note,
    previousLabel: "—",
    reference: true,
    sparkline: [],
  };
}

function agendaHighlights(
  points: Array<{ dayOfWeek: number; hourBucketStart: number; value: number }>,
) {
  if (points.length === 0) {
    return {
      bestDays: "Sem leitura",
      peakHour: "Sem leitura",
      quietHour: "Sem leitura",
    };
  }

  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const totalsByDay = new Map<number, number>();
  const totalsByHour = new Map<number, number>();
  for (const point of points) {
    totalsByDay.set(
      point.dayOfWeek,
      (totalsByDay.get(point.dayOfWeek) ?? 0) + point.value,
    );
    totalsByHour.set(
      point.hourBucketStart,
      (totalsByHour.get(point.hourBucketStart) ?? 0) + point.value,
    );
  }
  const bestDays = [...totalsByDay.entries()]
    .sort(([, left], [, right]) => right - left)
    .slice(0, 2)
    .map(([day]) => dayNames[day])
    .join(", ");
  const hours = [...totalsByHour.entries()].sort(
    ([, left], [, right]) => right - left,
  );
  const peak = hours[0]?.[0];
  const quiet = hours.at(-1)?.[0];

  return {
    bestDays: bestDays || "Sem leitura",
    peakHour: peak === undefined ? "Sem leitura" : `${peak}h – ${peak + 2}h`,
    quietHour:
      quiet === undefined ? "Sem leitura" : `${quiet}h – ${quiet + 2}h`,
  };
}

function discoveryKpi(
  discoveryStatus: TherapistMetricsOverview["discovery"]["status"],
  metric: TherapistMetricsOverview["discovery"]["stages"]["profileViews"],
) {
  if (discoveryStatus !== "ready") {
    return {
      copy: "Coleta pública indisponível nesta versão",
      state: "unavailable" as const,
      value: "—",
    };
  }
  if (metric.status === "empty") {
    return {
      copy: "Nenhum evento registrado neste período",
      state: "empty" as const,
      value: "0",
    };
  }
  return {
    copy: "Eventos agregados do período completo",
    state: "ready" as const,
    value: formatMetricValue(metric.value, "events"),
  };
}

function dashboardHasActivity(data: TherapistMetricsDashboard) {
  const { occupancy, overview, sessions } = data;
  const counters = Object.values(overview.counters);
  const hasCounterHistory = counters.some(
    (counter) => counter.value > 0 || counter.previousValue > 0,
  );
  const hasDiscoveryHistory =
    overview.discovery.status === "ready" &&
    Object.values(overview.discovery.stages).some(
      (counter) => counter.value > 0 || counter.previousValue > 0,
    );
  const hasOccupancyHistory =
    occupancy.status === "ready" &&
    (occupancy.current.offeredMinutes > 0 ||
      occupancy.previous.offeredMinutes > 0);

  return (
    hasCounterHistory ||
    hasDiscoveryHistory ||
    hasOccupancyHistory ||
    sessions.heatmap.status === "ready" ||
    sessions.therapyDistribution.status === "ready" ||
    sessions.outcomeDistribution.status === "ready"
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(
    value,
  );
}

function formatPeriodRange(start: string, endExclusive: string) {
  const startDate = new Date(start);
  const endDate = new Date(endExclusive);
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
  return `${formatter.format(startDate)} – ${formatter.format(endDate)}`;
}

function segmentLabel(key: string) {
  return (
    (
      {
        active: "Ativas",
        inactive: "Inativas",
        new: "Novas",
        paused: "Pausadas",
        recurring: "Recorrentes",
      } as Record<string, string>
    )[key] ?? key
  );
}

function isInterestReady(
  value: TherapistInterestMetrics,
): value is TherapistInterestMetricsReady {
  return value.access.status === "ready";
}

export function TherapistMetricsErrorState({ message }: { message: string }) {
  return (
    <AppPageContainer className="max-w-[1280px]">
      <AppPageSection className="grid gap-5">
        <AlertCircle className="text-status-danger" size={28} />
        <div>
          <h1 className="font-display text-[34px] font-light italic leading-tight text-brand-deep sm:text-[46px]">
            Acompanhamento indisponível
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
            {message}
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 w-fit items-center justify-center rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover"
          href={routes.therapist.insights}
        >
          Tentar novamente
        </Link>
      </AppPageSection>
    </AppPageContainer>
  );
}
