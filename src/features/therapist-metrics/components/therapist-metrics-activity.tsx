import { ChartNoAxesCombined } from "lucide-react";

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
  const chart = createLineChart(points);

  return (
    <AppPageSection aria-labelledby="metrics-activity-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.15em] text-brand-primary">
            Ritmo de atendimentos
          </p>
          <h2
            className="mt-2 text-2xl font-extrabold text-brand-deep"
            id="metrics-activity-title"
          >
            Sessões concluídas ao longo do período
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary">
            A linha mostra o movimento diário dos últimos {periodDays} dias
            completos no seu fuso horário.
          </p>
        </div>
        <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <ChartNoAxesCombined aria-hidden="true" size={22} />
        </span>
      </div>

      {status === "empty" ? (
        <div className="mt-6 rounded-lg border border-brand-lavender bg-surface-soft p-5">
          <p className="text-sm font-extrabold text-brand-deep">
            Ainda sem sessões concluídas neste período.
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            O gráfico começará a se formar após as primeiras conclusões.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-hidden rounded-lg border border-brand-lavender bg-surface-soft px-3 pb-3 pt-4 sm:px-5 sm:pb-4">
            <svg
              aria-hidden="true"
              className="h-56 w-full overflow-visible sm:h-64"
              preserveAspectRatio="none"
              viewBox="0 0 720 240"
            >
              {[40, 90, 140, 190].map((position) => (
                <line
                  className="stroke-brand-lavender"
                  key={position}
                  strokeWidth="1"
                  x1="36"
                  x2="700"
                  y1={position}
                  y2={position}
                />
              ))}
              <path className="fill-brand-primary/10" d={chart.area} />
              <polyline
                className="fill-none stroke-brand-primary"
                points={chart.points}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="4"
              />
              {chart.coordinates.map((point) => (
                <circle
                  className="fill-white stroke-brand-primary"
                  cx={point.x}
                  cy={point.y}
                  key={point.date}
                  r="4"
                  strokeWidth="3"
                />
              ))}
            </svg>
            <div className="mt-1 flex justify-between gap-4 text-xs font-bold text-tesText-muted">
              <span>{formatDate(points[0]?.date, timezone)}</span>
              <span>
                {formatDate(points[points.length - 1]?.date, timezone)}
              </span>
            </div>
          </div>
          <ul className="sr-only">
            {points.map((point) => (
              <li key={point.date}>
                {formatDate(point.date, timezone)}: {point.sessionsCompleted}{" "}
                sessões concluídas.
              </li>
            ))}
          </ul>
        </>
      )}
    </AppPageSection>
  );
}

function createLineChart(points: TherapistMetricActivityPoint[]) {
  const chartWidth = 664;
  const chartHeight = 170;
  const left = 36;
  const bottom = 210;
  const maximum = Math.max(
    1,
    ...points.map((point) => point.sessionsCompleted),
  );
  const coordinates = points.map((point, index) => {
    const x =
      points.length <= 1
        ? left + chartWidth / 2
        : left + (index / (points.length - 1)) * chartWidth;
    const y = bottom - (point.sessionsCompleted / maximum) * chartHeight;

    return { date: point.date, x, y };
  });
  const line = coordinates.map((point) => point.x + "," + point.y).join(" ");
  const area = coordinates.length
    ? "M " +
      coordinates[0].x +
      " " +
      bottom +
      " L " +
      coordinates.map((point) => point.x + " " + point.y).join(" L ") +
      " L " +
      coordinates[coordinates.length - 1].x +
      " " +
      bottom +
      " Z"
    : "";

  return { area, coordinates, points: line };
}

function formatDate(value: string | undefined, timezone: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: timezone,
  }).format(new Date(value + "T12:00:00Z"));
}
