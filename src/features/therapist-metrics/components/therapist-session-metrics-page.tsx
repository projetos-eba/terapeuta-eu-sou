import {
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  Clock3,
  Info,
  UserCheck,
} from "lucide-react";

import {
  AppPageGrid,
  AppPageMain,
  AppPageAside,
  AppPageSection,
} from "@/components/app-page";
import { TESCard } from "@/components/tes";

import { getTherapistMetricCopy } from "../therapist-metrics.copy";
import type {
  TherapistMetricProtectedCollection,
  TherapistMetricSampledValue,
  TherapistSessionMetrics,
  TherapistSessionMetricsView,
} from "../therapist-metrics.types";
import { formatMetricValue } from "./therapist-metric-card";
import {
  DistributionDonut,
  MetricsHeatmap,
  SessionsEvolutionChart,
  TherapyBarsChart,
} from "./therapist-metrics-charts";
import { TherapistMetricsLayout } from "./therapist-metrics-layout";

const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function TherapistSessionMetricsPage({
  data,
}: {
  data: TherapistSessionMetrics | TherapistSessionMetricsView;
}) {
  return (
    <TherapistMetricsLayout meta={data.meta} tab="sessions">
      <section aria-labelledby="session-summary-title">
        <div className="mb-4">
          <h2
            className="font-display text-[30px] font-light italic leading-tight text-brand-deep sm:text-[36px]"
            id="session-summary-title"
          >
            Movimento das sessões
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            Resumo das sessões do seu próprio histórico. Os pagamentos são
            acompanhados separadamente.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCounter
            icon={CalendarCheck2}
            label="Sessões realizadas"
            metric={data.summary.sessionsCompleted}
          />
          <SampledSummary
            icon={UserCheck}
            label="Presença operacional"
            metric={data.summary.operationalPresence}
          />
          <SummaryCounter
            icon={CalendarX2}
            label="Cancelamentos"
            metric={data.summary.sessionsCancelled}
          />
          <SummaryCounter
            icon={CalendarClock}
            label="Reagendamentos aplicados"
            metric={data.summary.sessionsRescheduled}
          />
          <SummaryCounter
            icon={Clock3}
            label="Duração média reservada"
            metric={data.summary.reservedDurationAverage}
          />
        </div>
      </section>

      <AppPageGrid>
        <AppPageMain>
          <SessionEvolution data={data} />
          <SessionHeatmap data={data} />
          <TherapyDistribution data={data} />
        </AppPageMain>

        <AppPageAside>
          <OutcomeDistribution data={data} />
          <PresenceRanking
            collection={data.presenceByDay}
            label={(item) => dayLabels[item.dayOfWeek - 1]}
            title="Presença por dia"
          />
          <PresenceRanking
            collection={data.presenceByHour}
            label={(item) =>
              `${String(item.hourBucketStart).padStart(2, "0")}h – ${String(item.hourBucketStart + 2).padStart(2, "0")}h`
            }
            title="Presença por horário"
          />
          <UnavailableNotice />
        </AppPageAside>
      </AppPageGrid>
    </TherapistMetricsLayout>
  );
}

function SummaryCounter({
  icon: Icon,
  label,
  metric,
}: {
  icon: typeof CalendarCheck2;
  label: string;
  metric: TherapistSessionMetrics["summary"][
    | "reservedDurationAverage"
    | "sessionsCancelled"
    | "sessionsCompleted"
    | "sessionsRescheduled"];
}) {
  return (
    <TESCard
      as="article"
      className="relative grid min-h-[205px] content-between overflow-hidden border-brand-lavender/70 bg-gradient-to-b from-brand-lavenderSoft/60 via-white to-white p-5 shadow-[0_14px_34px_rgba(57,45,90,0.06)] before:absolute before:inset-x-5 before:top-0 before:h-[3px] before:rounded-b-full before:bg-brand-primary"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Icon aria-hidden="true" size={21} />
        </span>
        <span className="text-xs font-extrabold text-tesText-muted">
          vs. período anterior
        </span>
      </div>
      <div className="mt-5">
        <p className="text-sm font-extrabold leading-5 text-brand-deep">
          {label}
        </p>
        <p className="mt-2 text-[34px] font-extrabold leading-none text-brand-deep">
          {formatMetricValue(
            metric.value,
            metric.unit,
            metric.status === "empty",
          )}
        </p>
        <p className="mt-3 text-sm font-semibold leading-5 text-tesText-secondary">
          {getTherapistMetricCopy(metric.directionCopyKey)}
        </p>
      </div>
    </TESCard>
  );
}

function SampledSummary({
  icon: Icon,
  label,
  metric,
}: {
  icon: typeof UserCheck;
  label: string;
  metric: TherapistMetricSampledValue<"percent">;
}) {
  return (
    <TESCard
      as="article"
      className="relative grid min-h-[205px] content-between overflow-hidden border-brand-cyan/25 bg-gradient-to-b from-brand-cyanSoft via-white to-white p-5 shadow-[0_14px_34px_rgba(57,45,90,0.06)] before:absolute before:inset-x-5 before:top-0 before:h-[3px] before:rounded-b-full before:bg-brand-cyan"
    >
      <span className="grid size-11 place-items-center rounded-full bg-brand-cyanSoft text-status-info">
        <Icon aria-hidden="true" size={21} />
      </span>
      <div className="mt-5">
        <p className="text-sm font-extrabold leading-5 text-brand-deep">
          {label}
        </p>
        {metric.status === "ready" ? (
          <>
            <p className="mt-2 text-[34px] font-extrabold leading-none text-brand-deep">
              {formatPercent(metric.value)}
            </p>
            <p className="mt-3 text-sm font-semibold leading-5 text-tesText-secondary">
              {metric.previousValue === null
                ? "Este é o primeiro período com dados suficientes para esta leitura."
                : getTherapistMetricCopy(metric.directionCopyKey)}
            </p>
          </>
        ) : (
          <SampleLock observed={metric.observedSample} />
        )}
      </div>
    </TESCard>
  );
}

function SessionEvolution({
  data,
}: {
  data: TherapistSessionMetrics | TherapistSessionMetricsView;
}) {
  const comparison =
    "evolutionComparison" in data
      ? data.evolutionComparison
      : {
          meta: data.meta,
          points: data.evolution.points.map((point, index) => ({
            current: point.sessionsCompleted,
            currentDate: point.date,
            index,
            previous: 0,
            previousDate: point.date,
          })),
          status: data.evolution.status,
        };
  const points = comparison.points.map((point) => ({
    date: point.currentDate,
    previous: point.previous,
    previousDate: point.previousDate,
    sessionsCompleted: point.current,
  }));

  return (
    <AppPageSection
      className="relative min-w-0 overflow-hidden border-brand-cyan/25 bg-[radial-gradient(circle_at_94%_0%,var(--tes-color-brand-cyan-soft)_0%,transparent_34%),linear-gradient(180deg,#fff_0%,#fff_100%)] shadow-[0_14px_34px_rgba(57,45,90,0.06)]"
      aria-labelledby="session-evolution-title"
    >
      <h2
        className="text-xl font-extrabold text-brand-deep"
        id="session-evolution-title"
      >
        Evolução das sessões no período
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        Compare sessões concluídas com o intervalo imediatamente anterior de
        mesma duração. A linha tracejada representa o histórico anterior.
      </p>

      <div className="mt-5">
        <SessionsEvolutionChart
          currentPeriodLabel={`Atual · ${formatPeriodRange(comparison.meta.periodStart, comparison.meta.periodEnd)}`}
          empty={comparison.status === "empty"}
          points={points}
          previousPeriodLabel={`Anterior · ${formatPeriodRange(comparison.meta.previousPeriodStart, comparison.meta.previousPeriodEnd)}`}
        />
      </div>
      <SessionOutcomeSummary data={data} />
    </AppPageSection>
  );
}

function SessionHeatmap({ data }: { data: TherapistSessionMetrics }) {
  if (data.heatmap.status !== "ready") {
    return (
      <AppPageSection>
        <h2 className="text-xl font-extrabold text-brand-deep">
          Distribuição por dia e horário
        </h2>
        <ProtectedBlock collection={data.heatmap} />
      </AppPageSection>
    );
  }

  return (
    <AppPageSection
      className="border-status-success/20 bg-gradient-to-br from-white via-white to-status-successBg/60 shadow-[0_14px_34px_rgba(57,45,90,0.05)]"
      aria-labelledby="session-heatmap-title"
    >
      <h2
        className="text-xl font-extrabold text-brand-deep"
        id="session-heatmap-title"
      >
        Distribuição por dia e horário
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        Volume de sessões realizadas no seu fuso. Tons mais intensos indicam
        maior concentração no período selecionado.
      </p>
      <div className="mt-5">
        <MetricsHeatmap
          points={data.heatmap.items.map((item) => ({
            ...item,
            value: item.sessions,
          }))}
          valueLabel="sessões"
        />
      </div>
    </AppPageSection>
  );
}

function SessionOutcomeSummary({ data }: { data: TherapistSessionMetrics }) {
  const totals = data.evolution.points.reduce(
    (result, point) => ({
      cancelled: result.cancelled + point.sessionsCancelled,
      noShows: result.noShows + point.noShows,
      rescheduled: result.rescheduled + point.sessionsRescheduled,
    }),
    { cancelled: 0, noShows: 0, rescheduled: 0 },
  );
  const items = [
    {
      label: "Canceladas",
      tone: "bg-status-dangerBg text-status-danger",
      value: totals.cancelled,
    },
    {
      label: "Ausências",
      tone: "bg-brand-cyanSoft text-status-info",
      value: totals.noShows,
    },
    {
      label: "Reagendadas",
      tone: "bg-status-warningBg text-status-warning",
      value: totals.rescheduled,
    },
  ];
  return (
    <dl className="mt-4 grid gap-2 border-t border-brand-lavender/55 pt-4 sm:grid-cols-3">
      {items.map((item) => (
        <div
          className={`rounded-card px-3 py-2.5 ${item.tone}`}
          key={item.label}
        >
          <dt className="text-xs font-bold">{item.label}</dt>
          <dd className="mt-1 text-lg font-extrabold">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function OutcomeDistribution({ data }: { data: TherapistSessionMetrics }) {
  return (
    <AppPageSection>
      <h2 className="text-lg font-extrabold text-brand-deep">
        Comparecimento e resultados
      </h2>
      {data.outcomeDistribution.status === "ready" ? (
        <DistributionDonut
          centerLabel={`${data.outcomeDistribution.observedSample} sessões`}
          compact
          items={data.outcomeDistribution.items.map((item) => ({
            label: item.label,
            value: item.value,
          }))}
          label="Distribuição dos resultados das sessões"
        />
      ) : (
        <ProtectedBlock collection={data.outcomeDistribution} />
      )}
    </AppPageSection>
  );
}

function TherapyDistribution({ data }: { data: TherapistSessionMetrics }) {
  return (
    <AppPageSection>
      <h2 className="text-xl font-extrabold text-brand-deep">
        Sessões realizadas por terapia
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        Esta leitura considera a terapia escolhida na reserva.
      </p>
      {data.therapyDistribution.status === "ready" ? (
        <TherapyBarsChart
          items={data.therapyDistribution.items.map((item) => ({
            name: item.therapyName,
            value: item.sessions,
          }))}
        />
      ) : (
        <ProtectedBlock collection={data.therapyDistribution} />
      )}
    </AppPageSection>
  );
}

function PresenceRanking<T extends { percentage: number; sample: number }>({
  collection,
  label,
  title,
}: {
  collection: TherapistMetricProtectedCollection<T>;
  label: (item: T) => string;
  title: string;
}) {
  return (
    <AppPageSection>
      <h2 className="text-lg font-extrabold text-brand-deep">{title}</h2>
      {collection.status === "ready" ? (
        <div className="mt-5 grid gap-4">
          {collection.items.map((item, index) => (
            <MetricBar
              key={`${label(item)}-${index}`}
              label={label(item)}
              percentage={item.percentage}
              value={formatPercent(item.percentage)}
            />
          ))}
        </div>
      ) : (
        <ProtectedBlock collection={collection} />
      )}
    </AppPageSection>
  );
}

function UnavailableNotice() {
  return (
    <AppPageSection>
      <Info aria-hidden="true" className="text-brand-primary" size={21} />
      <h2 className="mt-4 text-base font-extrabold text-brand-deep">
        Motivos de cancelamento
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        Ainda não conseguimos mostrar essas categorias com segurança. Por isso,
        os motivos escritos livremente permanecem ocultos nesta visão.
      </p>
    </AppPageSection>
  );
}

function ProtectedBlock({
  collection,
}: {
  collection: TherapistMetricProtectedCollection<unknown>;
}) {
  if (collection.status === "empty") {
    return <EmptyBlock text="Ainda não há dados neste período." />;
  }

  return (
    <div className="mt-5 rounded-lg bg-brand-lavenderSoft p-4">
      <p className="text-sm font-extrabold text-brand-deep">
        Mais dados são necessários
      </p>
      <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
        Esta leitura aparece a partir de {collection.minimumSample} registros
        elegíveis. Ainda não há dados suficientes para mostrar este resultado.
      </p>
    </div>
  );
}

function SampleLock({ observed }: { observed: number }) {
  return (
    <div className="mt-3">
      <p className="text-sm font-extrabold text-brand-primary">
        Ainda sem dados suficientes
      </p>
      <p className="mt-1 text-sm font-semibold leading-5 text-tesText-secondary">
        A taxa aparece após 10 resultados elegíveis. Até agora, temos {observed}
        .
      </p>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="mt-5 rounded-lg bg-surface-soft p-4">
      <p className="text-sm font-bold leading-6 text-tesText-secondary">
        {text}
      </p>
    </div>
  );
}

function MetricBar({
  label,
  percentage,
  value,
}: {
  label: string;
  percentage: number;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <span className="text-sm font-bold text-tesText-secondary">
          {label}
        </span>
        <span className="text-sm font-extrabold text-brand-deep">{value}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-lavenderSoft">
        <span
          className="block h-full rounded-full bg-brand-primary"
          style={{ width: `${Math.max(2, percentage)}%` }}
        />
      </div>
    </div>
  );
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
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
