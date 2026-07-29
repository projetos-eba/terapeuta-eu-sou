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
} from "../therapist-metrics.types";
import { formatMetricValue } from "./therapist-metric-card";
import { TherapistMetricsLayout } from "./therapist-metrics-layout";

const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function TherapistSessionMetricsPage({
  data,
}: {
  data: TherapistSessionMetrics;
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
            Desfechos operacionais calculados pelos bookings no seu próprio
            histórico. Pagamento continua sendo uma dimensão separada.
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
    <TESCard as="article" className="grid min-h-[205px] content-between p-5">
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
          {formatMetricValue(metric.value, metric.unit)}
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
    <TESCard as="article" className="grid min-h-[205px] content-between p-5">
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
                ? "Este é o primeiro período com amostra suficiente para esta leitura."
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

function SessionEvolution({ data }: { data: TherapistSessionMetrics }) {
  const points = bucketEvolution(
    data.evolution.points,
    data.meta.periodDays === 90 ? 7 : 3,
  );
  const maximum = Math.max(
    1,
    ...points.map(
      (point) =>
        point.sessionsCompleted + point.sessionsCancelled + point.noShows,
    ),
  );

  return (
    <AppPageSection aria-labelledby="session-evolution-title">
      <h2
        className="text-xl font-extrabold text-brand-deep"
        id="session-evolution-title"
      >
        Evolução das sessões no período
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        Realizações, ausências, cancelamentos e reagendamentos permanecem
        separados para não atribuir a mesma causa a desfechos diferentes.
      </p>

      {data.evolution.status === "empty" ? (
        <EmptyBlock text="Ainda não há desfechos de sessão neste período." />
      ) : (
        <>
          <div
            aria-hidden="true"
            className="mt-6 grid h-52 items-end gap-2 rounded-lg bg-surface-soft p-4"
            style={{
              gridTemplateColumns: `repeat(${points.length}, minmax(18px, 1fr))`,
            }}
          >
            {points.map((point) => (
              <div
                className="flex h-full flex-col justify-end gap-0.5"
                key={point.date}
                title={`${point.date}: ${point.sessionsCompleted} realizadas, ${point.noShows} ausências, ${point.sessionsCancelled} canceladas`}
              >
                <span
                  className="block min-h-0.5 rounded-t-sm bg-status-danger"
                  style={{
                    height: `${(point.sessionsCancelled / maximum) * 100}%`,
                  }}
                />
                <span
                  className="block min-h-0.5 bg-brand-cyan"
                  style={{ height: `${(point.noShows / maximum) * 100}%` }}
                />
                <span
                  className="block min-h-1 bg-brand-primary"
                  style={{
                    height: `${Math.max(2, (point.sessionsCompleted / maximum) * 100)}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <ul className="sr-only">
            {points.map((point) => (
              <li key={point.date}>
                {point.date}: {point.sessionsCompleted} realizadas,{" "}
                {point.noShows} ausências, {point.sessionsCancelled} canceladas
                e {point.sessionsRescheduled} reagendamentos aplicados.
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-tesText-secondary">
            <Legend color="bg-brand-primary" label="Realizadas" />
            <Legend color="bg-brand-cyan" label="Ausências" />
            <Legend color="bg-status-danger" label="Canceladas" />
          </div>
        </>
      )}
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

  const maximum = Math.max(
    1,
    ...data.heatmap.items.map((item) => item.sessions),
  );
  const countByCell = new Map(
    data.heatmap.items.map((item) => [
      `${item.dayOfWeek}:${item.hourBucketStart}`,
      item.sessions,
    ]),
  );
  const hours = Array.from({ length: 12 }, (_, index) => index * 2);

  return (
    <AppPageSection aria-labelledby="session-heatmap-title">
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
      <div
        aria-label="Tabela de sessões realizadas por dia e faixa de horário"
        className="mt-5 overflow-x-auto pb-2"
        role="region"
        tabIndex={0}
      >
        <table className="min-w-[720px] border-separate border-spacing-1.5">
          <thead>
            <tr>
              <th className="p-1 text-left text-xs text-tesText-muted">Dia</th>
              {hours.map((hour) => (
                <th
                  className="p-1 text-center text-xs text-tesText-muted"
                  key={hour}
                  scope="col"
                >
                  {String(hour).padStart(2, "0")}h
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dayLabels.map((day, dayIndex) => (
              <tr key={day}>
                <th
                  className="p-1 text-left text-xs font-extrabold text-brand-deep"
                  scope="row"
                >
                  {day}
                </th>
                {hours.map((hour) => {
                  const count = countByCell.get(`${dayIndex + 1}:${hour}`) ?? 0;
                  return (
                    <td className="p-0.5" key={hour}>
                      <span
                        aria-label={`${day}, ${String(hour).padStart(2, "0")}h a ${String(hour + 2).padStart(2, "0")}h: ${count} sessões`}
                        className="relative grid h-9 min-w-10 place-items-center overflow-hidden rounded bg-brand-lavenderSoft text-xs font-extrabold text-brand-deep"
                      >
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 bg-brand-primary"
                          style={{
                            opacity:
                              count === 0
                                ? 0.08
                                : Math.max(0.25, count / maximum),
                          }}
                        />
                        <span className="relative">{count}</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppPageSection>
  );
}

function OutcomeDistribution({ data }: { data: TherapistSessionMetrics }) {
  return (
    <AppPageSection>
      <h2 className="text-lg font-extrabold text-brand-deep">
        Comparecimento e desfechos
      </h2>
      {data.outcomeDistribution.status === "ready" ? (
        <div className="mt-5 grid gap-4">
          {data.outcomeDistribution.items.map((item) => (
            <MetricBar
              key={item.key}
              label={item.label}
              percentage={item.percentage}
              value={`${item.value} (${formatPercent(item.percentage)})`}
            />
          ))}
        </div>
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
        Esta leitura usa a terapia canônica vinculada ao serviço reservado.
      </p>
      {data.therapyDistribution.status === "ready" ? (
        <div className="mt-5 grid gap-4">
          {data.therapyDistribution.items.map((item) => (
            <MetricBar
              key={item.therapyId}
              label={item.therapyName}
              percentage={item.percentage}
              value={`${item.sessions} sessões`}
            />
          ))}
        </div>
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
        Ainda não mostramos categorias de motivo porque o campo atual não possui
        uma taxonomia versionada. Textos livres não são analisados nem
        transformados em métricas.
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
        elegíveis. A amostra atual ainda não atingiu essa trava.
      </p>
    </div>
  );
}

function SampleLock({ observed }: { observed: number }) {
  return (
    <div className="mt-3">
      <p className="text-sm font-extrabold text-brand-primary">
        Ainda sem amostra suficiente
      </p>
      <p className="mt-1 text-sm font-semibold leading-5 text-tesText-secondary">
        A taxa aparece após 10 desfechos elegíveis. Amostra atual: {observed}.
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

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={`size-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function bucketEvolution(
  points: TherapistSessionMetrics["evolution"]["points"],
  size: number,
) {
  const result: TherapistSessionMetrics["evolution"]["points"] = [];
  for (let index = 0; index < points.length; index += size) {
    const group = points.slice(index, index + size);
    if (group.length === 0) continue;
    result.push({
      date: group[0].date,
      noShows: sum(group, "noShows"),
      sessionsCancelled: sum(group, "sessionsCancelled"),
      sessionsCompleted: sum(group, "sessionsCompleted"),
      sessionsRescheduled: sum(group, "sessionsRescheduled"),
    });
  }
  return result;
}

function sum(
  points: TherapistSessionMetrics["evolution"]["points"],
  key:
    | "noShows"
    | "sessionsCancelled"
    | "sessionsCompleted"
    | "sessionsRescheduled",
) {
  return points.reduce((total, point) => total + point[key], 0);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}
