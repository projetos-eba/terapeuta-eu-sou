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
import { TherapistPlan } from "@/domain/tes";
import { TherapistLockedCard } from "@/features/therapist-access";
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
  const heatmapPoints =
    sessions.heatmap.status === "ready"
      ? sessions.heatmap.items.map((point) => ({
          ...point,
          value: point.sessions,
        }))
      : [];
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
              value={returnRateKpi.value}
            />
          )}
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
              A estrutura do funil já está pronta. Os números aparecem após a
              ativação formal da coleta pública.
            </MetricsVisualFootnote>
          ) : null}
        </MetricPanel>

        <MetricsAgendaSummary data={data} />
      </div>

      <MetricPanel
        description={`Sessões concluídas nos últimos ${data.meta.periodDays} dias completos, com o dia atual fora da comparação.`}
        icon={CalendarCheck2}
        title="Evolução das sessões"
      >
        <SessionsEvolutionChart
          empty={overview.activity.status !== "ready"}
          points={overview.activity.points}
        />
      </MetricPanel>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <MetricPanel
          description="Grupos de continuidade são mostrados separadamente e não formam uma distribuição única."
          icon={UsersRound}
          title="Pessoas acompanhadas"
        >
          <PatientContinuityCards
            interest={interestData}
            plan={data.therapist.plan}
          />
        </MetricPanel>

        <MetricPanel
          description="Terapias com mais sessões concluídas no período. A leitura não representa procura."
          icon={Star}
          title="Top terapias"
        >
          <TherapyRankingTable
            empty={sessions.therapyDistribution.status !== "ready"}
            items={sessions.therapyDistribution.items}
          />
        </MetricPanel>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <MetricPanel
          description="Concentração das sessões concluídas por dia e faixa de horário, no seu fuso."
          icon={Clock3}
          title="Melhores dias e horários"
        >
          <MetricsHeatmap
            emptyMessage="A grade será preenchida conforme as sessões forem concluídas."
            points={heatmapPoints}
            valueLabel="sessões"
          />
        </MetricPanel>

        <MetricPanel
          description="Comparação com o seu próprio período anterior, sem benchmark entre profissionais."
          icon={RefreshCw}
          title="Comparativo com o período anterior"
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
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <MetricPanel
          description="A classificação por abordagem ainda não faz parte do contrato de dados disponível nesta visão."
          icon={Sparkles}
          title="Demanda por abordagem"
        >
          <DistributionDonut
            centerLabel="0 sessões"
            empty
            emptyMessage="A visualização será ativada quando houver uma classificação autorizada por abordagem."
            items={[]}
            label="Demanda por abordagem"
          />
        </MetricPanel>

        <MetricPanel
          description="Situação final registrada para as sessões do período."
          icon={CalendarCheck2}
          title="Resultados das sessões"
        >
          <DistributionDonut
            centerLabel={`${sessions.outcomeDistribution.observedSample} sessões`}
            empty={sessions.outcomeDistribution.status !== "ready"}
            emptyMessage="A rosca mostra a composição das sessões quando houver base suficiente."
            items={sessions.outcomeDistribution.items.map((item) => ({
              label: item.label,
              value: item.value,
            }))}
            label="Distribuição dos resultados das sessões"
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
  const isReference = value === "—";
  const stateLabel = {
    empty: "Sem base",
    forming: "Em formação",
    ready: null,
    unavailable: "Indisponível",
  }[state];

  return (
    <TESCard
      as="article"
      className="flex min-h-[174px] min-w-0 flex-col border-brand-lavender/90 p-3 sm:min-h-[214px] sm:p-5"
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
        <span className="mt-2 inline-flex min-h-7 w-fit items-center rounded-full bg-brand-lavenderSoft px-2.5 text-xs font-extrabold text-brand-primary">
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
        />
      </div>
    </TESCard>
  );
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
  return (
    <MetricPanel
      description="Uma leitura compacta da capacidade e da concentração das sessões no período."
      icon={Clock3}
      title="Resumo da agenda"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(190px,0.72fr)_minmax(0,1fr)] lg:items-start">
        <dl className="grid gap-3">
          <AgendaStat
            label="Total de sessões"
            value={formatMetricValue(
              data.overview.counters.sessionsCompleted.value,
              "sessions",
            )}
          />
          <AgendaStat
            label="Taxa de ocupação"
            value={
              occupancy.status === "ready" &&
              occupancy.current.percentage !== null
                ? `${formatNumber(occupancy.current.percentage)}%`
                : occupancy.status === "forming"
                  ? "Em formação"
                  : "Sem base"
            }
          />
          <AgendaStat label="Melhores dias" value={highlights.bestDays} />
          <AgendaStat label="Horários de pico" value={highlights.peakHour} />
          <AgendaStat label="Horários ociosos" value={highlights.quietHour} />
        </dl>
        <div className="min-w-0">
          <p className="mb-3 text-xs font-extrabold text-brand-primary">
            Ocupação por dia e horário
          </p>
          <MetricsHeatmap
            emptyMessage="A leitura por horário aparece conforme a agenda cria histórico suficiente."
            points={heatmapPoints}
            valueLabel="sessões"
          />
        </div>
      </div>
    </MetricPanel>
  );
}

function AgendaStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="size-8 shrink-0 rounded-full bg-brand-lavenderSoft"
      />
      <div className="min-w-0">
        <dt className="text-sm font-bold text-brand-primary">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-extrabold text-brand-deep">
          {value}
        </dd>
      </div>
    </div>
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
  return (
    <div className="grid gap-3">
      <ol aria-label="Ranking de terapias realizadas" className="grid gap-3">
        {visualItems.map((item, index) => (
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
                  className={`block h-full rounded-full ${
                    empty ? "bg-brand-lavender" : "bg-brand-primary"
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
        ))}
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
      {items.map((item) => (
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
            />
            <span className="text-xs font-extrabold text-brand-primary">
              {item.reference ? "—" : item.deltaLabel}
            </span>
          </div>
        </div>
      ))}
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
    <AppPageSection className={`min-w-0 p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex items-start gap-3">
        <Icon
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-brand-primary"
          size={23}
        />
        <div>
          <h2 className="text-lg font-extrabold text-brand-deep sm:text-xl">
            {title}
          </h2>
          <p className="mt-1 text-sm font-semibold leading-5 text-tesText-secondary">
            {description}
          </p>
        </div>
      </div>
      {children}
    </AppPageSection>
  );
}

function PatientContinuityCards({
  interest,
  plan,
}: {
  interest: TherapistInterestMetricsReady | null;
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

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((item) => (
          <div
            className="rounded-card border border-brand-lavender/70 bg-surface-soft/60 p-3"
            key={item.key}
          >
            <span
              aria-hidden="true"
              className="mb-3 block size-7 rounded-full bg-brand-lavenderSoft"
            />
            <p className="text-xs font-bold text-tesText-secondary">
              {item.label}
            </p>
            <p className="mt-1 text-xl font-extrabold text-brand-deep">
              {formatNumber(item.value)}
            </p>
          </div>
        ))}
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
