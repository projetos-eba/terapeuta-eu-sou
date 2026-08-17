import Link from "next/link";
import {
  ArrowUpRight,
  Heart,
  Repeat2,
  Sparkles,
  UsersRound,
} from "lucide-react";

import {
  AppPageAside,
  AppPageGrid,
  AppPageMain,
  AppPageSection,
} from "@/components/app-page";
import { TESCard } from "@/components/tes";
import { routes } from "@/lib/routes";

import { getTherapistMetricCopy } from "../therapist-metrics.copy";
import type {
  TherapistInterestMetrics,
  TherapistInterestMetricsReady,
  TherapistMetricProtectedCollection,
  TherapistMetricSampledValue,
} from "../therapist-metrics.types";
import { TherapistMetricsLayout } from "./therapist-metrics-layout";

const segmentLabels = {
  active: "Ativas",
  inactive: "Inativas",
  new: "Novas",
  paused: "Em pausa",
  recurring: "Recorrentes",
} as const;

export function TherapistInterestMetricsPage({
  data,
}: {
  data: TherapistInterestMetrics;
}) {
  if (!isReadyInterest(data)) {
    return (
      <TherapistMetricsLayout meta={data.meta} tab="interest">
        <AppPageSection className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
          <div>
            <p className="text-sm font-extrabold text-brand-primary">
              Recurso Premium Plus
            </p>
            <h2 className="mt-2 font-display text-[32px] font-light italic leading-tight text-brand-deep sm:text-[40px]">
              Continuidade com contexto e privacidade
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary">
              A aba Interesse reúne retorno, evolução da base e coortes quando
              existe amostra suficiente. Ela não mostra nomes, ranking entre
              profissionais nem tendências agregadas do portal.
            </p>
          </div>
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            href={routes.therapist.plan}
          >
            Conhecer Premium Plus
            <ArrowUpRight aria-hidden="true" size={18} />
          </Link>
        </AppPageSection>
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
            Comparações feitas apenas com seu próprio histórico e protegidas
            pela amostra mínima de 10 registros elegíveis.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SampledCard
            icon={Repeat2}
            label="Pessoas que voltaram"
            metric={data.summary.peopleReturned}
          />
          <SampledCard
            icon={UsersRound}
            label="Taxa de retorno"
            metric={data.summary.returnRate}
          />
          <SampledCard
            icon={Sparkles}
            label="Sessões por pessoa"
            metric={data.summary.sessionsPerPerson}
          />
          <SampledCard
            icon={Heart}
            label="Novos favoritos do perfil"
            metric={data.summary.profileFavorites}
          />
        </div>
      </section>

      <AppPageGrid>
        <AppPageMain>
          <BaseEvolution data={data} />
          <CohortTable data={data} />
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

function SampledCard({
  icon: Icon,
  label,
  metric,
}: {
  icon: typeof Repeat2;
  label: string;
  metric:
    | TherapistMetricSampledValue<"favorites">
    | TherapistMetricSampledValue<"people">
    | TherapistMetricSampledValue<"percent">
    | TherapistMetricSampledValue<"ratio">;
}) {
  return (
    <TESCard as="article" className="grid min-h-[215px] content-between p-5">
      <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <Icon aria-hidden="true" size={21} />
      </span>
      <div className="mt-5">
        <p className="text-sm font-extrabold leading-5 text-brand-deep">
          {label}
        </p>
        {metric.status === "ready" ? (
          <>
            <p className="mt-2 text-[34px] font-extrabold leading-none text-brand-deep">
              {formatSampledValue(metric.value, metric.unit)}
            </p>
            <p className="mt-3 text-sm font-semibold leading-5 text-tesText-secondary">
              {metric.previousValue === null
                ? "Este é o primeiro período com amostra suficiente para esta leitura."
                : getTherapistMetricCopy(metric.directionCopyKey)}
            </p>
          </>
        ) : (
          <ProtectedSummary
            minimum={metric.minimumSample}
            observed={metric.observedSample}
          />
        )}
      </div>
    </TESCard>
  );
}

function Segments({ data }: { data: TherapistInterestMetricsReady }) {
  return (
    <AppPageSection>
      <h2 className="text-lg font-extrabold text-brand-deep">
        Distribuição por continuidade
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        Os segmentos são exclusivos e seguem uma regra versionada. Nenhuma
        pessoa é contada em dois grupos.
      </p>
      {data.segments.status === "ready" ? (
        <div className="mt-5 grid gap-4">
          {data.segments.items.map((item) => (
            <MetricBar
              key={item.key}
              label={segmentLabels[item.key]}
              percentage={item.percentage}
              value={`${item.value} (${formatPercent(item.percentage)})`}
            />
          ))}
        </div>
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

  const maximum = Math.max(
    1,
    ...data.baseEvolution.items.map((point) => point.totalPeople),
  );

  return (
    <AppPageSection aria-labelledby="base-evolution-title">
      <h2
        className="text-xl font-extrabold text-brand-deep"
        id="base-evolution-title"
      >
        Evolução da base atendida
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        A linha visual compara o total acumulado de pessoas atendidas e as
        primeiras sessões em blocos de sete dias.
      </p>
      <div
        aria-hidden="true"
        className="mt-6 grid h-52 items-end gap-2 rounded-lg bg-surface-soft p-4"
        style={{
          gridTemplateColumns: `repeat(${data.baseEvolution.items.length}, minmax(24px, 1fr))`,
        }}
      >
        {data.baseEvolution.items.map((point) => (
          <div
            className="flex h-full items-end gap-1"
            key={point.date}
            title={`${point.date}: ${point.totalPeople} pessoas no total; ${point.newPeople} novas`}
          >
            <span
              className="block w-1/2 min-w-2 rounded-t-sm bg-brand-primary"
              style={{
                height: `${Math.max(3, (point.totalPeople / maximum) * 100)}%`,
              }}
            />
            <span
              className="block w-1/2 min-w-2 rounded-t-sm bg-brand-cyan"
              style={{
                height: `${Math.max(3, (point.newPeople / maximum) * 100)}%`,
              }}
            />
          </div>
        ))}
      </div>
      <ul className="sr-only">
        {data.baseEvolution.items.map((point) => (
          <li key={point.date}>
            {point.date}: {point.totalPeople} pessoas no total e{" "}
            {point.newPeople} novas.
          </li>
        ))}
      </ul>
    </AppPageSection>
  );
}

function CohortTable({ data }: { data: TherapistInterestMetricsReady }) {
  return (
    <AppPageSection>
      <h2 className="text-xl font-extrabold text-brand-deep">
        Retorno por coorte
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        Cada linha reúne pessoas cuja primeira sessão realizada ocorreu no mesmo
        mês. Só entram coortes com pelo menos 10 pessoas.
      </p>
      {data.cohorts.status === "ready" ? (
        <div
          aria-label="Retorno mensal por coorte"
          className="mt-5 overflow-x-auto"
          role="region"
          tabIndex={0}
        >
          <table className="min-w-[650px] border-separate border-spacing-1.5">
            <thead>
              <tr>
                <th className="p-2 text-left text-xs text-tesText-muted">
                  Início
                </th>
                {Array.from({ length: 6 }, (_, index) => (
                  <th
                    className="p-2 text-center text-xs text-tesText-muted"
                    key={index}
                    scope="col"
                  >
                    Mês {index}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.cohorts.items.map((cohort) => (
                <tr key={cohort.cohortMonth}>
                  <th
                    className="p-2 text-left text-sm font-extrabold text-brand-deep"
                    scope="row"
                  >
                    {formatMonth(cohort.cohortMonth)}
                  </th>
                  {Array.from({ length: 6 }, (_, offset) => {
                    const point = cohort.retention.find(
                      (item) => item.monthOffset === offset,
                    );
                    return (
                      <td className="p-0.5 text-center" key={offset}>
                        {point ? (
                          <span className="relative block overflow-hidden rounded bg-brand-lavenderSoft px-2 py-3 text-xs font-extrabold text-brand-deep">
                            <span
                              aria-hidden="true"
                              className="absolute inset-0 bg-brand-primary"
                              style={{
                                opacity: Math.max(0.25, point.percentage / 100),
                              }}
                            />
                            <span className="relative">
                              {formatPercent(point.percentage)}
                            </span>
                          </span>
                        ) : (
                          <span className="block px-2 py-3 text-xs text-tesText-muted">
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ProtectedCollection collection={data.cohorts} />
      )}
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
        compara o retorno com a própria oferta.
      </p>
      {data.therapyReturn.status === "ready" ? (
        <div className="mt-5 grid gap-4">
          {data.therapyReturn.items.map((item) => (
            <MetricBar
              key={item.therapyId}
              label={item.therapyName}
              percentage={item.returnRate}
              value={`${item.returnedPeople} de ${item.people}`}
            />
          ))}
        </div>
      ) : (
        <ProtectedCollection collection={data.therapyReturn} />
      )}
    </AppPageSection>
  );
}

function UnavailableSignals() {
  const items = [
    {
      label: "Favoritos que viraram encontro",
      reason:
        "A ligação histórica entre favorito e booking ainda não existe com privacidade suficiente.",
    },
    {
      label: "Sentimento pós-sessão",
      reason: "Ainda não há dados suficientes para esta leitura.",
    },
    {
      label: "Lacuna da agenda",
      reason: "O sinal de procura sem disponibilidade ainda não foi ativado.",
    },
    {
      label: "Temas e motivos de saída",
      reason:
        "Textos livres não são analisados e ainda não há taxonomia versionada.",
    },
  ];

  return (
    <AppPageSection>
      <h2 className="text-lg font-extrabold text-brand-deep">
        Leituras ainda indisponíveis
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
        Esta leitura só aparece quando a amostra protegida alcança{" "}
        {collection.minimumSample} registros elegíveis.
      </p>
    </div>
  );
}

function ProtectedSummary({
  minimum,
  observed,
}: {
  minimum: number;
  observed: number;
}) {
  return (
    <div className="mt-3">
      <p className="text-sm font-extrabold text-brand-primary">
        Ainda sem amostra suficiente
      </p>
      <p className="mt-1 text-sm font-semibold leading-5 text-tesText-secondary">
        Disponível a partir de {minimum} registros elegíveis. Amostra atual:{" "}
        {observed}.
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

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    timeZone: "UTC",
    year: "2-digit",
  }).format(new Date(`${value}T12:00:00Z`));
}

function isReadyInterest(
  data: TherapistInterestMetrics,
): data is TherapistInterestMetricsReady {
  return data.access.status === "ready";
}
