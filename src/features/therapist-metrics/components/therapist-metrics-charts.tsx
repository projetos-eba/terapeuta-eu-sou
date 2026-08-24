"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { TherapistChartTooltip } from "./therapist-chart-tooltip";

const colors = {
  cyan: "var(--tes-color-brand-cyan)",
  deep: "var(--tes-color-brand-deep)",
  lavender: "var(--tes-color-brand-lavender)",
  mint: "var(--tes-color-brand-mint)",
  primary: "var(--tes-color-brand-primary)",
  warning: "var(--tes-color-status-warning)",
};

export function MetricSparkline({
  className = "h-12",
  data,
  empty = false,
  label,
  tone = "primary",
}: {
  className?: string;
  data: Array<{ label: string; value: number }>;
  empty?: boolean;
  label: string;
  tone?: "primary" | "warning";
}) {
  const visualData =
    empty || data.length < 2
      ? Array.from({ length: 7 }, (_, index) => ({
          label: String(index + 1),
          value: 0,
        }))
      : data;

  return (
    <div
      aria-label={empty ? `${label}: ainda sem dados` : label}
      className={`${className} w-full`}
      role="img"
      tabIndex={0}
    >
      <ResponsiveContainer height="100%" width="100%">
        <LineChart
          accessibilityLayer
          data={visualData}
          margin={{ bottom: 2, left: 2, right: 2, top: 2 }}
        >
          <Line
            dataKey="value"
            dot={false}
            isAnimationActive={false}
            stroke={
              empty
                ? colors.lavender
                : tone === "warning"
                  ? colors.warning
                  : colors.primary
            }
            name="Valor"
            strokeLinecap="round"
            strokeDasharray={empty ? "4 4" : undefined}
            strokeWidth={empty ? 2 : 2.5}
            type="monotone"
          />
          <Tooltip
            content={<TherapistChartTooltip />}
            cursor={{ stroke: colors.lavender, strokeDasharray: "4 4" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SessionsEvolutionChart({
  empty = false,
  points,
}: {
  empty?: boolean;
  points: Array<{
    date: string;
    previous?: number;
    sessionsCompleted: number;
  }>;
}) {
  const visualPoints =
    empty || points.length === 0
      ? Array.from({ length: 7 }, (_, index) => ({
          date: `referência-${index + 1}`,
          sessionsCompleted: 0,
        }))
      : points;

  return (
    <figure>
      <div
        aria-hidden="true"
        className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-tesText-secondary"
      >
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-5 rounded-full bg-brand-primary" />
          Sessões concluídas
        </span>
        {points.some((point) => typeof point.previous === "number") ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-0 w-5 border-t-2 border-dashed border-brand-cyan" />
            Período anterior
          </span>
        ) : null}
      </div>
      <div
        aria-label={
          empty
            ? "Evolução diária das sessões concluídas: ainda sem dados"
            : "Evolução diária das sessões concluídas no período"
        }
        className="h-[238px] w-full sm:h-[260px]"
        role="img"
        tabIndex={0}
      >
        <ResponsiveContainer height="100%" width="100%">
          <AreaChart
            accessibilityLayer
            data={visualPoints}
            margin={{ left: -22, right: 8, top: 12 }}
          >
            <defs>
              <linearGradient id="sessionsArea" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={colors.primary}
                  stopOpacity={0.3}
                />
                <stop
                  offset="100%"
                  stopColor={colors.primary}
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke={colors.lavender}
              strokeDasharray="3 5"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              minTickGap={28}
              tickFormatter={(value) =>
                String(value).startsWith("referência") ? "" : shortDate(value)
              }
              tickLine={false}
            />
            <YAxis allowDecimals={false} tickLine={false} width={34} />
            <Tooltip
              content={
                <TherapistChartTooltip
                  labelFormatter={(value) => fullDate(String(value))}
                />
              }
              cursor={{ stroke: colors.lavender, strokeDasharray: "4 4" }}
              isAnimationActive={false}
            />
            <Area
              dataKey="sessionsCompleted"
              dot={{
                fill: "white",
                r: 3,
                stroke: colors.primary,
                strokeWidth: 2,
              }}
              fill="url(#sessionsArea)"
              isAnimationActive={false}
              name="Sessões concluídas"
              activeDot={{
                fill: colors.primary,
                r: 6,
                stroke: "white",
                strokeWidth: 2,
              }}
              stroke={colors.primary}
              strokeWidth={3}
              type="monotone"
            />
            {points.some((point) => typeof point.previous === "number") ? (
              <Line
                dataKey="previous"
                dot={false}
                isAnimationActive={false}
                name="Período anterior"
                activeDot={{
                  fill: colors.cyan,
                  r: 5,
                  stroke: "white",
                  strokeWidth: 2,
                }}
                stroke={colors.cyan}
                strokeDasharray="6 5"
                strokeWidth={2}
                type="monotone"
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
        {empty
          ? "O gráfico será preenchido conforme as sessões forem concluídas no período."
          : "Cada ponto representa sessões concluídas em um dia completo, no fuso horário da sua agenda."}
      </figcaption>
    </figure>
  );
}

export function TherapyBarsChart({
  items,
}: {
  items: Array<{ name: string; value: number }>;
}) {
  return (
    <div
      aria-label="Ranking de terapias por sessões"
      className="h-[260px] w-full"
      role="img"
      tabIndex={0}
    >
      <ResponsiveContainer height="100%" width="100%">
        <BarChart
          accessibilityLayer
          data={items}
          layout="vertical"
          margin={{ bottom: 4, left: 12, right: 20, top: 4 }}
        >
          <CartesianGrid
            horizontal={false}
            stroke={colors.lavender}
            strokeDasharray="3 5"
          />
          <XAxis allowDecimals={false} type="number" />
          <YAxis dataKey="name" tickLine={false} type="category" width={112} />
          <Tooltip
            content={<TherapistChartTooltip />}
            cursor={{ fill: "var(--tes-color-surface-soft)" }}
            isAnimationActive={false}
          />
          <Bar
            dataKey="value"
            fill={colors.primary}
            isAnimationActive={false}
            name="Sessões"
            radius={[0, 8, 8, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DistributionDonut({
  centerLabel,
  empty = false,
  emptyMessage = "Ainda sem dados no período",
  items,
  label,
}: {
  centerLabel: string;
  empty?: boolean;
  emptyMessage?: string;
  items: Array<{ label: string; value: number }>;
  label: string;
}) {
  const palette = [
    colors.primary,
    colors.cyan,
    colors.warning,
    colors.mint,
    colors.deep,
  ];
  const hasValues = items.some((item) => item.value > 0);
  const isReference = empty || !hasValues;
  const visualItems = isReference ? [{ label: "Sem dados", value: 1 }] : items;

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(180px,0.9fr)_minmax(0,1fr)] sm:items-center">
      <div
        aria-label={isReference ? `${label}: ainda sem dados` : label}
        className="relative mx-auto h-[190px] w-full max-w-[260px]"
        role="img"
        tabIndex={0}
      >
        <ResponsiveContainer height="100%" width="100%">
          <PieChart accessibilityLayer>
            <Pie
              data={visualItems}
              dataKey="value"
              innerRadius="62%"
              isAnimationActive={false}
              nameKey="label"
              outerRadius="88%"
              paddingAngle={2}
            >
              {visualItems.map((item, index) => (
                <Cell
                  fill={
                    isReference
                      ? "var(--tes-color-brand-lavender-soft)"
                      : palette[index % palette.length]
                  }
                  key={item.label}
                />
              ))}
            </Pie>
            <Tooltip
              content={<TherapistChartTooltip />}
              isAnimationActive={false}
            />
          </PieChart>
        </ResponsiveContainer>
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-center text-sm font-extrabold text-brand-deep">
          {isReference ? "0" : centerLabel}
        </span>
      </div>
      <ul className="grid gap-2 text-sm font-semibold text-tesText-secondary">
        {isReference ? (
          <li className="rounded-card bg-surface-soft px-3 py-2 leading-5 text-tesText-secondary">
            {emptyMessage}
          </li>
        ) : (
          items.map((item, index) => (
            <li
              className="flex items-center justify-between gap-3"
              key={item.label}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: palette[index % palette.length] }}
                />
                <span className="truncate">{item.label}</span>
              </span>
              <strong className="shrink-0 text-brand-deep">{item.value}</strong>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function MetricsHeatmap({
  emptyMessage,
  points,
  valueLabel,
}: {
  emptyMessage?: string;
  points: Array<{ dayOfWeek: number; hourBucketStart: number; value: number }>;
  valueLabel: string;
}) {
  const days = [
    { label: "Seg", value: 1 },
    { label: "Ter", value: 2 },
    { label: "Qua", value: 3 },
    { label: "Qui", value: 4 },
    { label: "Sex", value: 5 },
    { label: "Sáb", value: 6 },
    { label: "Dom", value: 0 },
  ];
  const observedHours = Array.from(
    new Set(points.map((point) => point.hourBucketStart)),
  ).sort((a, b) => a - b);
  const hours =
    observedHours.length > 0 ? observedHours : [8, 10, 12, 14, 16, 18, 20, 22];
  const maximum = Math.max(1, ...points.map((point) => point.value));
  const isReference = points.length === 0;
  return (
    <div
      aria-label={
        isReference
          ? `Mapa de calor de ${valueLabel}: ainda sem dados`
          : `Mapa de calor de ${valueLabel} por dia e horário`
      }
      className="w-full min-w-0 overflow-x-auto pb-2"
      role="region"
      tabIndex={0}
    >
      <table
        className="w-full min-w-[460px] table-fixed border-separate border-spacing-0.5 sm:min-w-0 sm:border-spacing-1"
        aria-label={valueLabel}
      >
        <colgroup>
          <col className="w-10 sm:w-14" />
          {days.map((day) => (
            <col key={day.value} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="p-0.5 text-left text-[11px] font-bold text-tesText-muted sm:p-1 sm:text-xs">
              Hora
            </th>
            {days.map((day) => (
              <th
                className="p-0.5 text-center text-[11px] font-bold text-tesText-muted sm:p-1 sm:text-xs"
                key={day.value}
              >
                {day.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hours.map((hour) => (
            <tr key={hour}>
              <th className="p-0.5 text-left text-[11px] font-bold text-tesText-muted sm:p-1 sm:text-xs">
                {String(hour).padStart(2, "0")}h
              </th>
              {days.map((day) => {
                const point = points.find(
                  (item) =>
                    item.dayOfWeek === day.value &&
                    item.hourBucketStart === hour,
                );
                const value = point?.value ?? 0;
                const opacity =
                  value === 0 ? 0.08 : 0.2 + (value / maximum) * 0.8;
                return (
                  <td key={day.value}>
                    <span
                      aria-label={`${day.label}, ${hour}h: ${value} ${valueLabel}`}
                      className="block h-7 rounded sm:h-8 sm:rounded-md"
                      style={{
                        background: `color-mix(in srgb, var(--tes-color-brand-primary) ${Math.round(opacity * 100)}%, white)`,
                      }}
                      tabIndex={0}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-3 text-xs font-bold text-tesText-muted">
        <span>{isReference ? "Sem dados" : "Menos"}</span>
        <span
          aria-hidden="true"
          className="h-3 flex-1 rounded-full bg-gradient-to-r from-brand-lavenderSoft via-brand-lavender to-brand-primary"
        />
        <span>{isReference ? "Aguardando" : "Mais"}</span>
      </div>
      {isReference && emptyMessage ? (
        <p className="mt-2 text-xs font-semibold leading-5 text-tesText-secondary">
          {emptyMessage}
        </p>
      ) : null}
    </div>
  );
}

export function MetricsFunnel({
  stages,
}: {
  stages: Array<{ label: string; value: number }>;
}) {
  const maximum = Math.max(1, ...stages.map((stage) => stage.value));
  const isReference = stages.every((stage) => stage.value === 0);
  return (
    <ol aria-label="Funil de conversão" className="grid gap-4">
      {stages.map((stage, index) => (
        <li
          className="grid gap-2 sm:grid-cols-[170px_minmax(0,1fr)_auto] sm:items-center"
          key={stage.label}
        >
          <span className="text-sm font-extrabold text-brand-deep">
            {stage.label}
          </span>
          <span className="relative h-12 overflow-hidden rounded-lg bg-brand-lavenderSoft">
            <span
              aria-hidden="true"
              className={`absolute inset-y-0 left-0 ${
                isReference
                  ? "bg-brand-lavender/70"
                  : "bg-gradient-to-r from-brand-lavender to-brand-primary"
              }`}
              style={{
                clipPath: "polygon(0 0, 100% 12%, 100% 88%, 0 100%)",
                width: isReference
                  ? `${100 - index * 12}%`
                  : stage.value === 0
                    ? "0%"
                    : `${Math.max(14, (stage.value / maximum) * (100 - index * 8))}%`,
              }}
            />
          </span>
          <strong className="text-lg text-brand-deep">
            {new Intl.NumberFormat("pt-BR").format(stage.value)}
          </strong>
        </li>
      ))}
    </ol>
  );
}

export function JourneyFunnel({
  stages,
}: {
  stages: Array<{ label: string; value: number }>;
}) {
  return <MetricsFunnel stages={stages} />;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function fullDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}
