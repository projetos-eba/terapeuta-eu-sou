import { BarChart3 } from "lucide-react";

import { AppPageSection } from "@/components/app-page";

import type { TherapistMetricActivityPoint } from "../therapist-metrics.types";

export function TherapistMetricsActivity({
  periodDays,
  points,
  status,
  timezone,
}: {
  periodDays: 30 | 90;
  points: TherapistMetricActivityPoint[];
  status: "empty" | "ready";
  timezone: string;
}) {
  const buckets = bucketActivity(points, periodDays === 90 ? 7 : 3);
  const maximum = Math.max(1, ...buckets.map((bucket) => bucket.value));

  return (
    <AppPageSection aria-labelledby="metrics-activity-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-extrabold text-brand-primary">
            Ritmo de atendimentos
          </p>
          <h2
            className="mt-1 text-xl font-extrabold text-brand-deep"
            id="metrics-activity-title"
          >
            Sessões concluídas ao longo do período
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            Cada barra reúne {periodDays === 90 ? "sete" : "três"} dias
            completos no seu fuso horário.
          </p>
        </div>
        <span className="grid size-11 place-items-center rounded-lg bg-brand-cyanSoft text-status-info">
          <BarChart3 aria-hidden="true" size={22} />
        </span>
      </div>

      {status === "empty" ? (
        <div className="mt-6 rounded-lg bg-surface-soft p-5">
          <p className="text-sm font-bold text-brand-deep">
            Ainda sem sessões concluídas neste período.
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            O gráfico começará a se formar após as primeiras conclusões.
          </p>
        </div>
      ) : (
        <>
          <div
            aria-hidden="true"
            className="mt-7 grid h-48 items-end gap-1.5 rounded-lg bg-surface-soft px-3 pb-3 pt-5 sm:gap-2 sm:px-5"
            style={{
              gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))`,
            }}
          >
            {buckets.map((bucket) => (
              <div
                className="group relative flex h-full items-end"
                key={bucket.startDate}
                title={`${formatDate(bucket.startDate, timezone)}: ${bucket.value} sessões concluídas`}
              >
                <span
                  className="block min-h-1 w-full rounded-t-sm bg-brand-primary transition group-hover:bg-brand-primaryHover"
                  style={{
                    height: `${Math.max(3, (bucket.value / maximum) * 100)}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between gap-4 text-xs font-bold text-tesText-muted">
            <span>{formatDate(buckets[0]?.startDate, timezone)}</span>
            <span>
              {formatDate(buckets[buckets.length - 1]?.endDate, timezone)}
            </span>
          </div>
          <ul className="sr-only">
            {buckets.map((bucket) => (
              <li key={bucket.startDate}>
                De {formatDate(bucket.startDate, timezone)} a{" "}
                {formatDate(bucket.endDate, timezone)}: {bucket.value} sessões
                concluídas.
              </li>
            ))}
          </ul>
        </>
      )}
    </AppPageSection>
  );
}

function bucketActivity(
  points: TherapistMetricActivityPoint[],
  bucketSize: number,
) {
  const buckets: Array<{
    endDate: string;
    startDate: string;
    value: number;
  }> = [];

  for (let index = 0; index < points.length; index += bucketSize) {
    const group = points.slice(index, index + bucketSize);
    if (group.length === 0) continue;
    buckets.push({
      endDate: group[group.length - 1].date,
      startDate: group[0].date,
      value: group.reduce((sum, point) => sum + point.sessionsCompleted, 0),
    });
  }

  return buckets;
}

function formatDate(value: string | undefined, timezone: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: timezone,
  }).format(new Date(`${value}T12:00:00Z`));
}
