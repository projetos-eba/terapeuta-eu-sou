import { Heart, Repeat2, Sparkles, UsersRound } from "lucide-react";

import {
  AppPageAside,
  AppPageGrid,
  AppPageMain,
  AppPageSection,
} from "@/components/app-page";
import { TESCard } from "@/components/tes";
import { TherapistPlan } from "@/domain/tes";
import { TherapistLockedCard } from "@/features/therapist-access";

import { getTherapistMetricCopy } from "../therapist-metrics.copy";
import type {
  TherapistInterestMetrics,
  TherapistInterestMetricsReady,
  TherapistMetricProtectedCollection,
  TherapistMetricSampledValue,
} from "../therapist-metrics.types";
import { TherapistMetricsLayout } from "./therapist-metrics-layout";
import {
  DistributionDonut,
  PeopleEvolutionChart,
  TherapyBarsChart,
} from "./therapist-metrics-charts";

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
            Comparações feitas apenas com seu próprio histórico e mostradas
            quando há pelo menos 10 registros.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SampledCard
            icon={Repeat2}
            label="Pessoas que voltaram"
            metric={data.summary.peopleReturned}
            tone="primary"
          />
          <SampledCard
            icon={UsersRound}
            label="Taxa de retorno"
            metric={data.summary.returnRate}
            tone="mint"
          />
          <SampledCard
            icon={Sparkles}
            label="Sessões por pessoa"
            metric={data.summary.sessionsPerPerson}
            tone="warning"
          />
          <SampledCard
            icon={Heart}
            label="Novos favoritos do perfil"
            metric={data.summary.profileFavorites}
            tone="danger"
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
  tone,
}: {
  icon: typeof Repeat2;
  label: string;
  metric:
    | TherapistMetricSampledValue<"favorites">
    | TherapistMetricSampledValue<"people">
    | TherapistMetricSampledValue<"percent">
    | TherapistMetricSampledValue<"ratio">;
  tone: "danger" | "mint" | "primary" | "warning";
}) {
  const styles = {
    danger: "from-status-dangerBg/60 before:bg-status-danger",
    mint: "from-status-successBg/70 before:bg-status-success",
    primary: "from-brand-lavenderSoft/70 before:bg-brand-primary",
    warning: "from-status-warningBg/65 before:bg-status-warning",
  }[tone];
  return (
    <TESCard
      as="article"
      className={`relative grid min-h-[215px] content-between overflow-hidden border-brand-lavender/70 bg-gradient-to-b via-white to-white p-5 shadow-[0_14px_34px_rgba(57,45,90,0.06)] before:absolute before:inset-x-5 before:top-0 before:h-[3px] before:rounded-b-full ${styles}`}
    >
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
                ? "Este é o primeiro período com dados suficientes para esta leitura."
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
        Os grupos não se repetem: cada pessoa aparece em apenas uma categoria.
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

function CohortTable({ data }: { data: TherapistInterestMetricsReady }) {
  return (
    <AppPageSection>
      <h2 className="text-xl font-extrabold text-brand-deep">
        Retorno por grupo
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        Cada linha reúne pessoas cuja primeira sessão realizada ocorreu no mesmo
        mês. Só entram grupos com pelo menos 10 pessoas.
      </p>
      {data.cohorts.status === "ready" ? (
        <div
          aria-label="Retorno mensal por grupo"
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
        compara o retorno com a própria terapia.
      </p>
      {data.therapyReturn.status === "ready" ? (
        <TherapyBarsChart
          items={data.therapyReturn.items.map((item) => ({
            name: item.therapyName,
            value: item.returnRate,
          }))}
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
    {
      label: "Temas e motivos de saída",
      reason:
        "Textos escritos livremente ainda não podem ser organizados com segurança.",
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
        Ainda sem dados suficientes
      </p>
      <p className="mt-1 text-sm font-semibold leading-5 text-tesText-secondary">
        Disponível a partir de {minimum} registros. Até agora, temos {observed}.
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
