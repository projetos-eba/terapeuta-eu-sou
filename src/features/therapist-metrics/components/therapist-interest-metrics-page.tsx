import Link from "next/link";
import {
  Heart,
  Repeat2,
  Sparkles,
  UserCheck,
  UserMinus,
  UsersRound,
} from "lucide-react";

import {
  AppPageAside,
  AppPageGrid,
  AppPageMain,
  AppPageSection,
} from "@/components/app-page";
import { TESCard } from "@/components/tes";
import { TherapistPlan } from "@/domain/tes";
import { TherapistLockedCard } from "@/features/therapist-access";
import { routes } from "@/lib/routes";

import type {
  TherapistInterestMetrics,
  TherapistInterestMetricsReady,
  TherapistInterestSegmentKey,
  TherapistMetricDirection,
  TherapistMetricProtectedCollection,
  TherapistMetricsTodayActivityState,
} from "../therapist-metrics.types";
import { TherapistMetricsLayout } from "./therapist-metrics-layout";
import {
  DistributionDonut,
  MetricSparkline,
  PeopleEvolutionChart,
  TherapyBarsChart,
} from "./therapist-metrics-charts";
import type { MetricChartTone } from "./therapist-metrics-charts";

const segmentLabels = {
  active: "Ativas",
  inactive: "Inativas",
  new: "Novas",
  paused: "Em pausa",
  recurring: "Recorrentes",
} as const;

export function TherapistInterestMetricsPage({
  data,
  todayActivity = { status: "unavailable" },
}: {
  data: TherapistInterestMetrics;
  todayActivity?: TherapistMetricsTodayActivityState;
}) {
  if (!isReadyInterest(data)) {
    return (
      <TherapistMetricsLayout meta={data.meta} tab="interest">
        <TherapistLockedCard
          description="A aba Interesse reúne retorno, evolução das pessoas acompanhadas e grupos ao longo do tempo, sempre com cuidado com a privacidade."
          requiredPlan={TherapistPlan.PremiumPlus}
          title="Continuidade com contexto e privacidade"
          variant="section"
        />
      </TherapistMetricsLayout>
    );
  }

  return (
    <TherapistMetricsLayout meta={data.meta} tab="interest">
      <section aria-labelledby="interest-summary-title">
        <div className="mb-4">
          <h2
            className="font-display text-[30px] font-light italic leading-tight text-brand-deep sm:text-[36px]"
            id="interest-summary-title"
          >
            Continuidade do acompanhamento
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            Comparações feitas apenas com seu próprio histórico, usando dias
            completos. Favoritos recebidos hoje aparecem separadamente.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <SegmentSampledCard
            data={data}
            icon={UserCheck}
            label="Pessoas ativas"
            sampleCaption="pessoas na base atual"
            segment="active"
            tone="primary"
          />
          <SampledCard
            icon={Heart}
            label="Novos favoritos do perfil"
            metric={data.summary.profileFavorites}
            sampleCaption="favoritos até ontem"
            todayActivity={todayActivity}
            tone="danger"
          />
          <SampledCard
            icon={Repeat2}
            label="Pessoas que voltaram"
            metric={data.summary.peopleReturned}
            sampleCaption="pessoas no período"
            tone="primary"
          />
          <SampledCard
            icon={UsersRound}
            label="Taxa de retorno"
            metric={data.summary.returnRate}
            sampleCaption="pessoas no período"
            tone="mint"
          />
          <SegmentSampledCard
            data={data}
            icon={UserMinus}
            label="Pessoas inativas"
            sampleCaption="pessoas na base atual"
            segment="inactive"
            tone="danger"
          />
          <SampledCard
            icon={Sparkles}
            label="Sessões por pessoa"
            metric={data.summary.sessionsPerPerson}
            sampleCaption="pessoas no período"
            tone="warning"
          />
        </div>
      </section>

      <AppPageGrid>
        <AppPageMain>
          <BaseEvolution data={data} />
          <JourneyThemes data={data} />
          <TherapyReturn data={data} />
        </AppPageMain>

        <AppPageAside>
          <Segments data={data} />
          <UnavailableSignals />
        </AppPageAside>
      </AppPageGrid>
    </TherapistMetricsLayout>
  );
}

type InterestSummaryCardMetric =
  | {
      direction: TherapistMetricDirection | null;
      minimumSample: number;
      observedSample: number;
      previousValue: number | null;
      status: "ready";
      unit: "favorites" | "people" | "percent" | "ratio";
      value: number;
    }
  | {
      direction: null;
      minimumSample: number;
      observedSample: number;
      previousValue: null;
      status: "empty" | "insufficient_sample";
      unit: "favorites" | "people" | "percent" | "ratio";
      value: null;
    };

type InterestCardBadge = {
  accessibleLabel: string;
  caption: string;
  className: string;
  label: string;
};

function SegmentSampledCard({
  data,
  icon,
  label,
  sampleCaption,
  segment,
  tone,
}: {
  data: TherapistInterestMetricsReady;
  icon: typeof Repeat2;
  label: string;
  sampleCaption: string;
  segment: Extract<TherapistInterestSegmentKey, "active" | "inactive">;
  tone: Extract<MetricChartTone, "danger" | "primary">;
}) {
  const collection = data.segments;
  const item =
    collection.status === "ready"
      ? collection.items.find((entry) => entry.key === segment)
      : null;
  const metric: InterestSummaryCardMetric =
    collection.status === "ready"
      ? {
          direction: null,
          minimumSample: collection.minimumSample,
          observedSample: collection.observedSample,
          previousValue: null,
          status: "ready",
          unit: "people",
          value: item?.value ?? 0,
        }
      : {
          direction: null,
          minimumSample: collection.minimumSample,
          observedSample: collection.observedSample,
          previousValue: null,
          status: collection.status,
          unit: "people",
          value: null,
        };
  const badge: InterestCardBadge | undefined = item
    ? {
        accessibleLabel: `${formatPercent(item.percentage)} da base acompanhada`,
        caption: "da base no período",
        className:
          tone === "danger"
            ? "bg-status-dangerBg text-status-danger"
            : "bg-brand-lavenderSoft text-brand-primary",
        label: formatPercent(item.percentage),
      }
    : undefined;

  return (
    <SampledCard
      badge={badge}
      icon={icon}
      label={label}
      metric={metric}
      sampleCaption={sampleCaption}
      tone={tone}
    />
  );
}

function SampledCard({
  badge,
  icon: Icon,
  label,
  metric,
  sampleCaption,
  todayActivity,
  tone,
}: {
  badge?: InterestCardBadge;
  icon: typeof Repeat2;
  label: string;
  metric: InterestSummaryCardMetric;
  sampleCaption: string;
  todayActivity?: TherapistMetricsTodayActivityState;
  tone: Extract<MetricChartTone, "danger" | "mint" | "primary" | "warning">;
}) {
  const iconStyle = {
    danger: "bg-status-dangerBg text-status-danger",
    mint: "bg-status-successBg text-status-success",
    primary: "bg-brand-lavenderSoft text-brand-primary",
    warning: "bg-status-warningBg text-status-warning",
  }[tone];
  const trend =
    metric.status === "ready" ? (badge ?? getMetricTrend(metric)) : null;
  const sparkline =
    metric.status === "ready" && metric.previousValue !== null
      ? [
          { label: "Período anterior", value: metric.previousValue },
          { label: "Período atual", value: metric.value },
        ]
      : [];

  return (
    <TESCard
      as="article"
      className="relative flex min-h-[190px] min-w-0 flex-col overflow-hidden border-brand-lavender/55 bg-white p-4 shadow-[0_8px_22px_rgba(57,45,90,0.055)] sm:min-h-[198px]"
      data-state={metric.status}
      data-tone={tone}
    >
      <div className="flex min-h-10 items-start gap-3">
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-full ${iconStyle}`}
        >
          <Icon aria-hidden="true" size={18} />
        </span>
        <h3 className="pt-0.5 text-sm font-extrabold leading-[18px] text-brand-deep">
          {label}
        </h3>
      </div>
      {metric.status === "ready" ? (
        <>
          <p className="mt-3 text-[30px] font-extrabold leading-none text-brand-deep">
            {formatSampledValue(metric.value, metric.unit)}
          </p>
          <div className="mt-2 flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1">
            <span
              aria-label={trend?.accessibleLabel}
              className={`inline-flex min-h-6 items-center rounded-full px-2 text-xs font-extrabold ${trend?.className}`}
            >
              {trend?.label}
            </span>
            <span className="text-[10px] font-bold leading-4 text-tesText-muted md:text-[11px]">
              {trend?.caption}
            </span>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-[30px] font-extrabold leading-none text-brand-deep">
            <span className="sr-only">Valor ainda indisponível.</span>
            <span aria-hidden="true">—</span>
          </p>
          <div className="mt-2 flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1">
            <span
              aria-label={`${metric.observedSample} de ${metric.minimumSample} ${sampleCaption}`}
              className="inline-flex min-h-6 items-center rounded-full bg-brand-lavenderSoft px-2 text-xs font-extrabold text-brand-primary"
            >
              {metric.observedSample} de {metric.minimumSample}
            </span>
            <span className="text-[10px] font-bold leading-4 text-tesText-muted md:text-[11px]">
              {sampleCaption}
            </span>
            <span className="sr-only">Ainda sem dados suficientes.</span>
          </div>
        </>
      )}
      {todayActivity ? <TodayFavoritesStatus activity={todayActivity} /> : null}
      <div className="mt-auto pt-2.5">
        <MetricSparkline
          className="h-7"
          data={sparkline}
          empty={sparkline.length < 2}
          label={`Tendência de ${label}`}
          tone={tone}
        />
      </div>
    </TESCard>
  );
}

function TodayFavoritesStatus({
  activity,
}: {
  activity: TherapistMetricsTodayActivityState;
}) {
  if (activity.status === "unavailable") {
    return (
      <p className="mt-2 text-[10px] font-bold leading-4 text-tesText-muted md:text-[11px]">
        Não foi possível atualizar os favoritos de hoje.
      </p>
    );
  }

  const count = activity.profileFavoritesAdded.value;
  if (count === 0) {
    return (
      <p className="mt-2 text-[10px] font-bold leading-4 text-tesText-muted md:text-[11px]">
        Nenhum novo favorito hoje.
      </p>
    );
  }

  return (
    <p className="mt-2 rounded-lg bg-status-dangerBg px-2.5 py-2 text-[11px] font-extrabold leading-4 text-status-danger">
      +{count} {count === 1 ? "favorito" : "favoritos"} hoje
      <span className="mt-0.5 block font-bold text-tesText-secondary">
        Entra no comparativo amanhã.
      </span>
    </p>
  );
}

function getMetricTrend(
  metric: Extract<InterestSummaryCardMetric, { status: "ready" }>,
) {
  if (metric.previousValue === null) {
    return {
      accessibleLabel: "Primeiro período com dados suficientes",
      caption: "histórico em formação",
      className: "bg-brand-lavenderSoft text-brand-primary",
      label: "Primeiro período",
    };
  }

  if (metric.direction === "stable" || metric.value === metric.previousValue) {
    return {
      accessibleLabel: "Resultado estável em relação ao período anterior",
      caption: "vs. período anterior",
      className: "bg-brand-lavenderSoft text-brand-primary",
      label: "Estável",
    };
  }

  const arrow = metric.direction === "up" ? "↑" : "↓";
  const className =
    metric.direction === "up"
      ? "bg-status-successBg text-status-success"
      : "bg-status-dangerBg text-status-danger";
  const absoluteDifference = Math.abs(metric.value - metric.previousValue);
  const change =
    metric.unit === "percent"
      ? `${formatCompactNumber(absoluteDifference)} p.p.`
      : metric.previousValue === 0
        ? "novo resultado"
        : `${formatCompactNumber(
            (absoluteDifference / Math.abs(metric.previousValue)) * 100,
          )}%`;

  return {
    accessibleLabel: `${metric.direction === "up" ? "Aumento" : "Queda"} de ${change} em relação ao período anterior`,
    caption: "vs. período anterior",
    className,
    label: `${arrow} ${change}`,
  };
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value);
}

function Segments({ data }: { data: TherapistInterestMetricsReady }) {
  return (
    <AppPageSection>
      <h2 className="text-lg font-extrabold text-brand-deep">
        Distribuição por continuidade
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        Mostra em qual etapa de continuidade cada pessoa está no período. Cada
        pessoa aparece uma única vez, conforme sua situação mais recente.
      </p>
      {data.segments.status === "ready" ? (
        <DistributionDonut
          centerLabel={`${data.segments.observedSample} pessoas`}
          compact
          items={data.segments.items.map((item) => ({
            label: segmentLabels[item.key],
            value: item.value,
          }))}
          label="Distribuição das pessoas por continuidade"
        />
      ) : (
        <ProtectedCollection collection={data.segments} />
      )}
    </AppPageSection>
  );
}

function BaseEvolution({ data }: { data: TherapistInterestMetricsReady }) {
  if (data.baseEvolution.status !== "ready") {
    return (
      <AppPageSection>
        <h2 className="text-xl font-extrabold text-brand-deep">
          Evolução da base atendida
        </h2>
        <ProtectedCollection collection={data.baseEvolution} />
      </AppPageSection>
    );
  }

  return (
    <AppPageSection
      className="relative min-w-0 overflow-hidden border-brand-lavender/70 bg-[radial-gradient(circle_at_94%_0%,var(--tes-color-brand-lavender-soft)_0%,transparent_36%),linear-gradient(180deg,#fff_0%,#fff_100%)] shadow-[0_14px_34px_rgba(57,45,90,0.06)]"
      aria-labelledby="base-evolution-title"
    >
      <h2
        className="text-xl font-extrabold text-brand-deep"
        id="base-evolution-title"
      >
        Evolução da base atendida
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        Compare a base acompanhada e as novas pessoas em cada bloco do período.
        Passe o cursor ou navegue pelo gráfico para ver os valores exatos.
      </p>
      <div className="mt-5">
        <PeopleEvolutionChart points={data.baseEvolution.items} />
      </div>
    </AppPageSection>
  );
}

function JourneyThemes({ data }: { data: TherapistInterestMetricsReady }) {
  return (
    <AppPageSection aria-labelledby="journey-themes-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            className="text-xl font-extrabold text-brand-deep"
            id="journey-themes-title"
          >
            Temas mais recorrentes na jornada
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary">
            Reunirá os temas compartilhados diretamente pelas pessoas no
            Histórico da Jornada. Os percentuais mostrarão em quantas jornadas
            cada tema aparece, sem expor anotações individuais.
          </p>
        </div>
        <span className="inline-flex min-h-7 w-fit shrink-0 items-center rounded-full bg-brand-lavenderSoft px-3 text-xs font-extrabold text-brand-primary">
          Em preparação
        </span>
      </div>

      <div
        className="mt-5 rounded-card border border-dashed border-brand-lavender bg-brand-lavenderSoft/40 p-5"
        data-state={data.journeyThemes.status}
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-brand-primary shadow-card">
            <Sparkles aria-hidden="true" size={20} />
          </span>
          <div>
            <p className="text-sm font-extrabold text-brand-deep">
              Ainda não há temas estruturados para mostrar
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
              Quando os temas forem registrados nos detalhes de cada jornada,
              esta visão será atualizada com os mais recorrentes.
            </p>
          </div>
        </div>

        <Link
          className="mt-5 inline-flex min-h-10 items-center rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-primary transition-colors hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          href={routes.therapist.patients}
        >
          Abrir Histórico da Jornada →
        </Link>
      </div>
    </AppPageSection>
  );
}

function TherapyReturn({ data }: { data: TherapistInterestMetricsReady }) {
  return (
    <AppPageSection>
      <h2 className="text-xl font-extrabold text-brand-deep">
        Retorno por terapia
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        Mostra apenas terapias com pelo menos 10 pessoas atendidas no período e
        compara o retorno com a própria terapia.
      </p>
      {data.therapyReturn.status === "ready" ? (
        <TherapyBarsChart
          items={data.therapyReturn.items.map((item) => ({
            name: item.therapyName,
            value: item.returnRate,
          }))}
          label="Taxa de retorno por terapia"
          seriesLabel="Taxa de retorno"
          valueSuffix="%"
        />
      ) : (
        <ProtectedCollection collection={data.therapyReturn} />
      )}
    </AppPageSection>
  );
}

function UnavailableSignals() {
  const items = [
    {
      label: "Favoritos que viraram sessão",
      reason:
        "A ligação histórica entre favorito e sessão ainda não pode ser mostrada com segurança.",
    },
    {
      label: "Sentimento pós-sessão",
      reason: "Ainda não há dados suficientes para esta leitura.",
    },
    {
      label: "Lacuna da agenda",
      reason: "O sinal de procura sem disponibilidade ainda não foi ativado.",
    },
  ];

  return (
    <AppPageSection>
      <h2 className="text-lg font-extrabold text-brand-deep">
        Informações ainda indisponíveis
      </h2>
      <div className="mt-4 grid gap-4">
        {items.map((item) => (
          <div
            className="border-l-2 border-brand-lavender pl-4"
            key={item.label}
          >
            <p className="text-sm font-extrabold text-brand-deep">
              {item.label}
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
              {item.reason}
            </p>
          </div>
        ))}
      </div>
    </AppPageSection>
  );
}

function ProtectedCollection({
  collection,
}: {
  collection: TherapistMetricProtectedCollection<unknown>;
}) {
  if (collection.status === "empty") {
    return (
      <div className="mt-5 rounded-lg bg-surface-soft p-4 text-sm font-bold leading-6 text-tesText-secondary">
        Ainda não há dados neste período.
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-lg bg-brand-lavenderSoft p-4">
      <p className="text-sm font-extrabold text-brand-deep">
        Mais dados são necessários
      </p>
      <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
        Esta leitura aparece quando houver pelo menos {collection.minimumSample}{" "}
        registros neste período.
      </p>
    </div>
  );
}

function formatSampledValue(
  value: number,
  unit: "favorites" | "people" | "percent" | "ratio",
) {
  if (unit === "percent") return formatPercent(value);
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: unit === "ratio" ? 1 : 0,
  }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function isReadyInterest(
  data: TherapistInterestMetrics,
): data is TherapistInterestMetricsReady {
  return data.access.status === "ready";
}
