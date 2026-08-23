import Link from "next/link";
import {
  AlertCircle,
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
import { routes } from "@/lib/routes";

import { getTherapistMetricCopy } from "../therapist-metrics.copy";
import type {
  TherapistInterestMetrics,
  TherapistInterestMetricsReady,
  TherapistMetricCounter,
  TherapistMetricsDashboard,
  TherapistMetricsOverview,
} from "../therapist-metrics.types";
import {
  DistributionDonut,
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
  data: TherapistMetricsDashboard;
}) {
  const { overview, sessions, occupancy, interest } = data;
  const sparkline = overview.activity.points.map((point) => ({
    label: point.date,
    value: point.sessionsCompleted,
  }));
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
          value: "Indisponível",
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
            value: "Histórico em formação",
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
          value: "Indisponível",
        };

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
            value={profileViews.value}
          />
          <MetricsKpiCard
            copy={bookingStarts.copy}
            icon={CalendarCheck2}
            label="Interessados em agendar"
            sparkline={[]}
            state={bookingStarts.state}
            value={bookingStarts.value}
          />
          <MetricsKpiCard
            copy={getTherapistMetricCopy(
              overview.counters.sessionsCompleted.directionCopyKey,
            )}
            icon={CalendarCheck2}
            label="Sessões realizadas"
            sparkline={sparkline}
            value={formatMetricValue(
              overview.counters.sessionsCompleted.value,
              "sessions",
            )}
          />
          <MetricsKpiCard
            copy={returnRateKpi.copy}
            icon={RefreshCw}
            label="Taxa de retorno"
            sparkline={[]}
            state={returnRateKpi.state}
            value={returnRateKpi.value}
          />
          <MetricsKpiCard
            copy={occupancyKpi.copy}
            icon={Clock3}
            label="Ocupação da agenda"
            sparkline={
              occupancy.status === "ready"
                ? occupancy.series.map((point) => ({
                    label: point.date,
                    value: point.percentage ?? 0,
                  }))
                : []
            }
            state={occupancyKpi.state}
            value={occupancyKpi.value}
          />
          <MetricsKpiCard
            copy={therapyKpi.copy}
            icon={Sparkles}
            label="Terapia mais realizada"
            sparkline={sparkline}
            state={therapyKpi.state}
            value={therapyKpi.value}
          />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.1fr)]">
        <MetricPanel
          description="Veja em que ponto os eventos de descoberta podem ser medidos com segurança."
          icon={Eye}
          title="Funil de conversão"
        >
          {overview.discovery.status === "ready" ? (
            <MetricsFunnel
              stages={[
                {
                  label: "Visualizaram o perfil",
                  value: overview.discovery.stages.profileViews.value,
                },
                {
                  label: "Iniciaram o agendamento",
                  value: overview.discovery.stages.bookingFlowStarts.value,
                },
                {
                  label: "Sessões concluídas",
                  value: overview.counters.sessionsCompleted.value,
                },
              ]}
            />
          ) : (
            <MetricsPanelState
              message="Visualizações, interesse e funil permanecem ocultos até a revisão formal de privacidade e retenção."
              title="Coleta pública desativada"
              variant="unavailable"
            />
          )}
        </MetricPanel>

        <MetricsAgendaSummary data={data} />
      </div>

      <MetricPanel
        description={`Sessões concluídas nos últimos ${data.meta.periodDays} dias completos, com o dia atual fora da comparação.`}
        icon={CalendarCheck2}
        title="Evolução das sessões"
      >
        {overview.activity.status === "ready" ? (
          <SessionsEvolutionChart points={overview.activity.points} />
        ) : (
          <MetricsPanelState
            message="Ainda não há sessões concluídas neste período."
            title="Nenhuma sessão no período"
            variant="empty"
          />
        )}
      </MetricPanel>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <MetricPanel
          description="Terapias com mais sessões concluídas no período. A leitura não representa procura."
          icon={Star}
          title="Terapias mais realizadas"
        >
          {sessions.therapyDistribution.status === "ready" ? (
            <TherapyRankingTable items={sessions.therapyDistribution.items} />
          ) : (
            <ProtectedMetric status={sessions.therapyDistribution.status} />
          )}
        </MetricPanel>

        <MetricPanel
          description="Comparação com o seu próprio período anterior, sem benchmark entre profissionais."
          icon={RefreshCw}
          title="Comparativo com o período anterior"
        >
          <MetricsComparison
            items={[
              {
                label: "Pessoas acompanhadas",
                metric: overview.counters.peopleServed,
              },
              {
                label: "Sessões realizadas",
                metric: overview.counters.sessionsCompleted,
              },
              {
                label: "Tempo de atendimento",
                metric: overview.counters.serviceMinutes,
              },
            ]}
          />
        </MetricPanel>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <MetricPanel
          description="Concentração das sessões concluídas por dia e faixa de horário, no seu fuso."
          icon={Clock3}
          title="Melhores dias e horários"
        >
          {sessions.heatmap.status === "ready" ? (
            <MetricsHeatmap
              points={sessions.heatmap.items.map((point) => ({
                ...point,
                value: point.sessions,
              }))}
              valueLabel="sessões"
            />
          ) : (
            <ProtectedMetric status={sessions.heatmap.status} />
          )}
        </MetricPanel>

        <MetricPanel
          description="Situação final registrada para as sessões do período."
          icon={CalendarCheck2}
          title="Resultados das sessões"
        >
          {sessions.outcomeDistribution.status === "ready" ? (
            <DistributionDonut
              centerLabel={`${sessions.outcomeDistribution.observedSample} sessões`}
              items={sessions.outcomeDistribution.items.map((item) => ({
                label: item.label,
                value: item.value,
              }))}
              label="Distribuição dos resultados das sessões"
            />
          ) : (
            <ProtectedMetric status={sessions.outcomeDistribution.status} />
          )}
        </MetricPanel>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <MetricPanel
          description="As categorias são apresentadas como grupos de continuidade e não devem ser somadas como uma distribuição universal sem essa definição."
          icon={UsersRound}
          title="Pessoas acompanhadas por continuidade"
        >
          {interestData && interestData.segments.status === "ready" ? (
            <DistributionDonut
              centerLabel={`${interestData.segments.observedSample} pessoas`}
              items={interestData.segments.items.map((item) => ({
                label: segmentLabel(item.key),
                value: item.value,
              }))}
              label="Situação das pessoas acompanhadas"
            />
          ) : interestData ? (
            <ProtectedMetric status={interestData.segments.status} />
          ) : (
            <MetricsPanelState
              message="A leitura de continuidade é liberada no Premium Plus quando houver dados de pelo menos dez pessoas."
              title="Recurso do Premium Plus"
              variant="capability_locked"
            />
          )}
        </MetricPanel>

        <MetricPanel
          description="A classificação por abordagem ainda não faz parte do contrato de dados disponível nesta visão."
          icon={Sparkles}
          title="Demanda por abordagem"
        >
          <MetricsPanelState
            message="Este bloco será exibido quando houver uma classificação de abordagem real, versionada e autorizada."
            title="Dados indisponíveis"
            variant="unavailable"
          />
        </MetricPanel>
      </div>

      <AppPageSection className="grid gap-4 border-brand-lavender/80 bg-surface-soft/70 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
        <Info className="text-brand-primary" size={24} />
        <div>
          <h2 className="text-lg font-extrabold text-brand-deep">
            Como estes números são calculados
          </h2>
          <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-tesText-secondary">
            O dia atual fica de fora para evitar comparações incompletas. Alguns
            dados só aparecem quando há pelo menos dez registros, e a ocupação
            só é mostrada quando o histórico da agenda está completo.
          </p>
        </div>
      </AppPageSection>
    </TherapistMetricsLayout>
  );
}

function MetricsKpiCard({
  copy,
  icon: Icon,
  label,
  sparkline,
  state = "ready",
  value,
}: {
  copy: string;
  icon: LucideIcon;
  label: string;
  sparkline: Array<{ label: string; value: number }>;
  state?: "empty" | "forming" | "ready" | "unavailable";
  value: string;
}) {
  const isUnavailable = state === "unavailable";
  const stateLabel = {
    empty: "Sem base",
    forming: "Em formação",
    ready: null,
    unavailable: "Indisponível",
  }[state];

  return (
    <TESCard
      as="article"
      className="flex min-h-[204px] min-w-0 flex-col border-brand-lavender/90 p-4 sm:min-h-[214px] sm:p-5"
    >
      <div className="flex min-h-11 items-start gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Icon aria-hidden="true" size={18} />
        </span>
        <h3 className="text-sm font-extrabold leading-5 text-brand-deep">
          {label}
        </h3>
      </div>
      <p
        className={`mt-5 font-extrabold leading-tight text-brand-deep ${
          isUnavailable
            ? "whitespace-nowrap text-[22px] sm:text-[24px]"
            : "break-words text-[24px] sm:text-[28px]"
        }`}
      >
        {value}
      </p>
      {stateLabel ? (
        <span className="mt-2 inline-flex min-h-7 w-fit items-center rounded-full bg-brand-lavenderSoft px-2.5 text-xs font-extrabold text-brand-primary">
          {stateLabel}
        </span>
      ) : null}
      <p className="mt-2 min-h-10 text-sm font-semibold leading-5 text-tesText-secondary">
        {copy}
      </p>
      <div className="mt-auto pt-3">
        {sparkline.length > 1 ? (
          <MetricSparkline data={sparkline} label={`Tendência de ${label}`} />
        ) : (
          <div aria-hidden="true" className="h-8" />
        )}
      </div>
    </TESCard>
  );
}

function MetricsAgendaSummary({ data }: { data: TherapistMetricsDashboard }) {
  const { occupancy, sessions } = data;
  return (
    <MetricPanel
      description="Uma leitura compacta da capacidade e da concentração das sessões no período."
      icon={Clock3}
      title="Resumo da agenda"
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <AgendaStat
            label="Ocupação atual"
            value={
              occupancy.status === "ready" &&
              occupancy.current.percentage !== null
                ? `${formatNumber(occupancy.current.percentage)}%`
                : occupancy.status === "forming"
                  ? "Histórico em formação"
                  : "Sem base"
            }
          />
          <AgendaStat
            label="Minutos ocupados"
            value={
              occupancy.status === "ready"
                ? formatMetricValue(
                    occupancy.current.occupiedMinutes,
                    "minutes",
                  )
                : "Indisponível"
            }
          />
          <AgendaStat
            label="Cobertura"
            value={
              occupancy.status === "forming"
                ? `${occupancy.coverageDays}/${occupancy.requiredCoverageDays} dias`
                : occupancy.status === "ready"
                  ? `${occupancy.coverageDays} dias`
                  : "Indisponível"
            }
          />
        </div>
        {sessions.heatmap.status === "ready" ? (
          <MetricsHeatmap
            points={sessions.heatmap.items.map((point) => ({
              ...point,
              value: point.sessions,
            }))}
            valueLabel="sessões"
          />
        ) : (
          <ProtectedMetric status={sessions.heatmap.status} />
        )}
      </div>
    </MetricPanel>
  );
}

function AgendaStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card bg-surface-soft p-3">
      <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-tesText-muted">
        {label}
      </p>
      <p className="mt-2 break-words text-base font-extrabold text-brand-deep sm:text-lg">
        {value}
      </p>
    </div>
  );
}

function TherapyRankingTable({
  items,
}: {
  items: Array<{
    percentage: number;
    sessions: number;
    therapyId: string;
    therapyName: string;
  }>;
}) {
  const maximum = Math.max(1, ...items.map((item) => item.sessions));
  return (
    <ol aria-label="Ranking de terapias realizadas" className="grid gap-3">
      {items.slice(0, 6).map((item, index) => (
        <li
          className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3"
          key={item.therapyId}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-sm font-extrabold text-brand-primary">
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
                className="block h-full rounded-full bg-brand-primary"
                style={{
                  width: `${Math.max(6, (item.sessions / maximum) * 100)}%`,
                }}
              />
            </span>
          </div>
          <span className="text-xs font-bold text-tesText-muted">sessões</span>
        </li>
      ))}
    </ol>
  );
}

function MetricsComparison({
  items,
}: {
  items: Array<{
    label: string;
    metric: TherapistMetricCounter<"minutes" | "people" | "sessions">;
  }>;
}) {
  return (
    <div
      aria-label="Comparativo de métricas"
      className="grid gap-3"
      role="list"
    >
      {items.map(({ label, metric }) => {
        const delta = metric.value - metric.previousValue;
        return (
          <div
            className="grid gap-2 rounded-card border border-brand-lavender/80 bg-surface-soft p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            key={label}
            role="listitem"
          >
            <div>
              <p className="text-sm font-extrabold text-brand-deep">{label}</p>
              <p className="mt-1 text-sm font-semibold text-tesText-secondary">
                Atual: {formatMetricValue(metric.value, metric.unit)} ·
                Anterior: {formatMetricValue(metric.previousValue, metric.unit)}
              </p>
            </div>
            <span className="text-sm font-extrabold text-brand-primary">
              {delta === 0
                ? "Estável"
                : `${delta > 0 ? "+" : "−"}${formatMetricValue(Math.abs(delta), metric.unit)}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MetricPanel({
  children,
  className = "",
  description,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <AppPageSection className={`min-w-0 ${className}`}>
      <div className="mb-5 flex items-start gap-3">
        <Icon
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-brand-primary"
          size={23}
        />
        <div>
          <h2 className="text-xl font-extrabold text-brand-deep sm:text-2xl">
            {title}
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            {description}
          </p>
        </div>
      </div>
      {children}
    </AppPageSection>
  );
}

function MetricsPanelState({
  message,
  title,
  variant,
}: {
  message: string;
  title: string;
  variant: "capability_locked" | "empty" | "processing" | "unavailable";
}) {
  const styles = {
    capability_locked: "border-brand-lavender bg-brand-lavenderSoft",
    empty: "border-border/80 bg-surface-soft",
    processing: "border-brand-lavender bg-brand-lavenderSoft",
    unavailable: "border-brand-lavender bg-surface-soft",
  }[variant];
  return (
    <div className={`rounded-card border p-5 ${styles}`}>
      <h3 className="text-base font-extrabold text-brand-deep">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {message}
      </p>
    </div>
  );
}

function ProtectedMetric({
  status,
}: {
  status: "empty" | "insufficient_sample" | "ready";
}) {
  return status === "empty" ? (
    <MetricsPanelState
      message="Ainda não há dados neste período."
      title="Nenhum registro no período"
      variant="empty"
    />
  ) : (
    <MetricsPanelState
      message="Este bloco será exibido quando houver pelo menos dez registros no período."
      title="Ainda não há dados suficientes"
      variant="unavailable"
    />
  );
}

function discoveryKpi(
  discoveryStatus: TherapistMetricsOverview["discovery"]["status"],
  metric: TherapistMetricsOverview["discovery"]["stages"]["profileViews"],
) {
  if (discoveryStatus !== "ready") {
    return {
      copy: "Coleta pública indisponível nesta versão",
      state: "unavailable" as const,
      value: "Indisponível",
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(
    value,
  );
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
