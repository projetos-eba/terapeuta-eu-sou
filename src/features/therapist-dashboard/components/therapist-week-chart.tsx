import type { TherapistDashboardPageData } from "../therapist-dashboard.types";

const COLORS = {
  cancelled: "#ef5b7a",
  completed: "#ae94c3",
  scheduled: "#482861",
};

export function TherapistWeekChart({
  days,
}: {
  days: TherapistDashboardPageData["week"]["days"];
}) {
  const width = 560;
  const height = 210;
  const chartTop = 16;
  const chartBottom = 164;
  const maxValue = Math.max(
    1,
    ...days.flatMap((day) => [day.scheduled, day.completed, day.cancelled]),
  );

  return (
    <div className="overflow-x-auto pb-2">
      <svg
        aria-label="Agendados, realizados e cancelamentos na semana"
        className="min-w-[540px]"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = chartBottom - (chartBottom - chartTop) * ratio;
          return (
            <line
              key={ratio}
              stroke="#eee9f8"
              strokeDasharray="4 5"
              x1="34"
              x2={width - 12}
              y1={y}
              y2={y}
            />
          );
        })}
        {(["scheduled", "completed", "cancelled"] as const).map((key) => (
          <polyline
            fill="none"
            key={key}
            points={buildPoints(
              days,
              key,
              maxValue,
              width,
              chartTop,
              chartBottom,
            )}
            stroke={COLORS[key]}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
          />
        ))}
        {days.map((day, index) => {
          const x = pointX(index, days.length, width);
          return (
            <g key={day.date}>
              <text
                fill="#825aa2"
                fontSize="11"
                textAnchor="middle"
                x={x}
                y="190"
              >
                {day.label}
              </text>
              <text
                fill="#a9a4c6"
                fontSize="9"
                textAnchor="middle"
                x={x}
                y="204"
              >
                {formatShortDate(day.date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function buildPoints(
  days: TherapistDashboardPageData["week"]["days"],
  key: "cancelled" | "completed" | "scheduled",
  maxValue: number,
  width: number,
  top: number,
  bottom: number,
) {
  return days
    .map((day, index) => {
      const x = pointX(index, days.length, width);
      const y = bottom - (day[key] / maxValue) * (bottom - top);
      return `${x},${y}`;
    })
    .join(" ");
}

function pointX(index: number, length: number, width: number) {
  const available = width - 64;
  return 42 + (index * available) / Math.max(1, length - 1);
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}
