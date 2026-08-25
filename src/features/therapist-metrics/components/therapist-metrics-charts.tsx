"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
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
  danger: "var(--tes-color-status-danger)",
  deep: "var(--tes-color-brand-deep)",
  lavender: "var(--tes-color-brand-lavender)",
  mint: "var(--tes-color-brand-mint)",
  primary: "var(--tes-color-brand-primary)",
  success: "var(--tes-color-status-success)",
  warning: "var(--tes-color-status-warning)",
};

export type MetricChartTone =
  | "cyan"
  | "danger"
  | "mint"
  | "primary"
  | "warning";

const toneColors: Record<MetricChartTone, string> = {
  cyan: colors.cyan,
  danger: colors.danger,
  mint: colors.success,
  primary: colors.primary,
  warning: colors.warning,
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
  tone?: MetricChartTone;
}) {
  const visualData =
    empty || data.length < 2
      ? Array.from({ length: 3 }, (_, index) => ({
          label: String(index + 1),
          value: 0,
        }))
      : data;

  return (
    <div
      aria-label={empty ? `${label}: ainda sem dados` : label}
      className={`${className} w-full`}
      data-point-count={visualData.length}
      role="img"
      tabIndex={0}
    >
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart
          accessibilityLayer
          data={visualData}
          margin={{ bottom: 2, left: 2, right: 2, top: 2 }}
        >
          <Area
            dataKey="value"
            dot={false}
            fill={empty ? colors.lavender : toneColors[tone]}
            fillOpacity={empty ? 0 : 0.12}
            isAnimationActive={false}
            stroke={empty ? colors.lavender : toneColors[tone]}
            strokeLinecap="round"
            strokeDasharray={empty ? "4 4" : undefined}
            strokeWidth={empty ? 2 : 2.5}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SessionsEvolutionChart({
  currentPeriodLabel = "Período atual",
  empty = false,
  points,
  previousPeriodLabel = "Período anterior",
}: {
  currentPeriodLabel?: string;
  empty?: boolean;
  points: Array<{
    date: string;
    previousDate?: string;
    previous?: number;
    sessionsCompleted: number;
  }>;
  previousPeriodLabel?: string;
}) {
  const visualPoints =
    empty || points.length === 0
      ? Array.from({ length: 7 }, (_, index) => ({
          date: `referência-${index + 1}`,
          sessionsCompleted: 0,
        }))
      : points;
  const completedTotal = points.reduce(
    (total, point) => total + point.sessionsCompleted,
    0,
  );
  const weeklyAverage =
    points.length === 0 ? 0 : completedTotal / Math.max(1, points.length / 7);
  const bestPoint = points.reduce<(typeof points)[number] | null>(
    (best, point) =>
      best === null || point.sessionsCompleted > best.sessionsCompleted
        ? point
        : best,
    null,
  );

  return (
    <figure>
      <div
        aria-hidden="true"
        className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-tesText-secondary"
      >
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-5 rounded-full bg-brand-primary" />
          {currentPeriodLabel}
        </span>
        {points.some((point) => typeof point.previous === "number") ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-0 w-5 border-t-2 border-dashed border-brand-cyan" />
            {previousPeriodLabel}
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
                  offset="58%"
                  stopColor={colors.lavender}
                  stopOpacity={0.16}
                />
                <stop
                  offset="100%"
                  stopColor={colors.cyan}
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
              axisLine={false}
              dataKey="date"
              minTickGap={28}
              tick={{ fill: "var(--tes-color-text-muted)", fontSize: 11 }}
              tickFormatter={(value) =>
                String(value).startsWith("referência") ? "" : shortDate(value)
              }
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tick={{ fill: "var(--tes-color-text-muted)", fontSize: 11 }}
              tickLine={false}
              width={34}
            />
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
              name={currentPeriodLabel}
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
                name={previousPeriodLabel}
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
      {!empty && points.length > 0 ? (
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-brand-lavender/55 pt-4">
          <div className="rounded-card bg-brand-lavenderSoft/70 px-3 py-2.5">
            <dt className="text-[11px] font-bold text-tesText-muted">
              Sessões concluídas
            </dt>
            <dd className="mt-1 text-lg font-extrabold text-brand-deep">
              {completedTotal}
            </dd>
          </div>
          <div className="rounded-card bg-brand-cyanSoft px-3 py-2.5">
            <dt className="text-[11px] font-bold text-tesText-muted">
              Média por semana
            </dt>
            <dd className="mt-1 text-lg font-extrabold text-status-info">
              {new Intl.NumberFormat("pt-BR", {
                maximumFractionDigits: 1,
              }).format(weeklyAverage)}
            </dd>
          </div>
          <div className="rounded-card bg-status-successBg px-3 py-2.5">
            <dt className="text-[11px] font-bold text-tesText-muted">
              Melhor dia
            </dt>
            <dd className="mt-1 text-lg font-extrabold text-status-success">
              {bestPoint?.sessionsCompleted ?? 0}
            </dd>
          </div>
        </dl>
      ) : null}
      <figcaption className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
        {empty
          ? "O gráfico será preenchido conforme as sessões forem concluídas no período."
          : "Cada ponto representa sessões concluídas em um dia completo, no fuso horário da sua agenda."}
      </figcaption>
    </figure>
  );
}

export function PeopleEvolutionChart({
  empty = false,
  points,
}: {
  empty?: boolean;
  points: Array<{ date: string; newPeople: number; totalPeople: number }>;
}) {
  const visualPoints =
    empty || points.length === 0
      ? Array.from({ length: 7 }, (_, index) => ({
          date: `referência-${index + 1}`,
          newPeople: 0,
          totalPeople: 0,
        }))
      : points;

  return (
    <figure>
      <div
        aria-hidden="true"
        className="mb-4 flex flex-wrap gap-5 text-xs font-bold text-tesText-secondary"
      >
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-5 rounded-full bg-brand-primary" /> Base
          acompanhada
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-5 rounded-full bg-status-success" /> Novas
          pessoas
        </span>
      </div>
      <div
        aria-label={
          empty
            ? "Evolução da base acompanhada: ainda sem dados"
            : "Evolução da base acompanhada no período"
        }
        className="h-[250px] w-full"
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
              <linearGradient id="peopleArea" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={colors.primary}
                  stopOpacity={0.28}
                />
                <stop
                  offset="100%"
                  stopColor={colors.lavender}
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
              axisLine={false}
              dataKey="date"
              minTickGap={28}
              tick={{ fill: "var(--tes-color-text-muted)", fontSize: 11 }}
              tickFormatter={(value) =>
                String(value).startsWith("referência") ? "" : shortDate(value)
              }
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tick={{ fill: "var(--tes-color-text-muted)", fontSize: 11 }}
              tickLine={false}
              width={34}
            />
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
              activeDot={{
                fill: colors.primary,
                r: 6,
                stroke: "white",
                strokeWidth: 2,
              }}
              dataKey="totalPeople"
              dot={{
                fill: "white",
                r: 3,
                stroke: colors.primary,
                strokeWidth: 2,
              }}
              fill="url(#peopleArea)"
              isAnimationActive={false}
              name="Base acompanhada"
              stroke={colors.primary}
              strokeWidth={3}
              type="monotone"
            />
            <Line
              activeDot={{
                fill: colors.success,
                r: 5,
                stroke: "white",
                strokeWidth: 2,
              }}
              dataKey="newPeople"
              dot={false}
              isAnimationActive={false}
              name="Novas pessoas"
              stroke={colors.success}
              strokeWidth={2.5}
              type="monotone"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
        Cada ponto reúne apenas dados agregados do seu próprio acompanhamento.
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
            isAnimationActive={false}
            name="Sessões"
            radius={[0, 8, 8, 0]}
          >
            {items.map((item, index) => (
              <Cell
                fill={
                  [
                    colors.primary,
                    colors.warning,
                    colors.success,
                    colors.danger,
                    colors.cyan,
                  ][index % 5]
                }
                key={item.name}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DistributionDonut({
  centerLabel,
  compact = false,
  empty = false,
  emptyMessage = "Ainda sem dados no período",
  items,
  label,
  palette = "default",
  showLegend = true,
  valueSuffix = "",
}: {
  centerLabel: string;
  compact?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  items: Array<{ label: string; value: number }>;
  label: string;
  palette?: "continuity" | "default" | "occupancy";
  showLegend?: boolean;
  valueSuffix?: string;
}) {
  const chartPalette =
    palette === "occupancy"
      ? [colors.primary, colors.lavender]
      : palette === "continuity"
        ? [colors.success, colors.mint]
        : [
            colors.primary,
            colors.cyan,
            colors.warning,
            colors.mint,
            colors.danger,
          ];
  const hasValues = items.some((item) => item.value > 0);
  const isReference = empty || !hasValues;
  const visualItems = isReference ? [{ label: "Sem dados", value: 1 }] : items;

  return (
    <div
      className={
        compact
          ? "grid gap-3"
          : "grid gap-4 sm:grid-cols-[minmax(180px,0.9fr)_minmax(0,1fr)] sm:items-center"
      }
    >
      <div
        aria-label={isReference ? `${label}: ainda sem dados` : label}
        className={`relative mx-auto w-full ${compact ? "h-[170px] max-w-[220px]" : "h-[190px] max-w-[260px]"}`}
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
                      : chartPalette[index % chartPalette.length]
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
      {showLegend ? (
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
                    style={{
                      background: chartPalette[index % chartPalette.length],
                    }}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                <strong className="shrink-0 text-brand-deep">
                  {String(item.value).replace(".", ",")}
                  {valueSuffix}
                </strong>
              </li>
            ))
          )}
        </ul>
      ) : isReference ? (
        <p className="rounded-card bg-surface-soft px-3 py-2 text-center text-xs font-semibold leading-5 text-tesText-secondary">
          {emptyMessage}
        </p>
      ) : null}
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
                      title={`${day.label}, ${String(hour).padStart(2, "0")}h–${String(hour + 2).padStart(2, "0")}h: ${value} ${valueLabel}`}
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
  stages: Array<{ label: string; value: number | null }>;
}) {
  const numericValues = stages.flatMap((stage) =>
    stage.value === null ? [] : [stage.value],
  );
  const maximum = Math.max(1, ...numericValues);
  const isReference = stages.some((stage) => stage.value === null);
  return (
    <ol aria-label="Funil de conversão" className="grid gap-3">
      {stages.map((stage, index) => (
        <li
          className="grid grid-cols-[minmax(112px,0.8fr)_minmax(120px,1.35fr)_auto] items-center gap-3"
          key={stage.label}
        >
          <span>
            <strong className="block text-xl font-extrabold text-brand-deep">
              {stage.value === null
                ? "-"
                : new Intl.NumberFormat("pt-BR").format(stage.value)}
            </strong>
            <span className="mt-0.5 block text-xs font-bold leading-4 text-tesText-secondary">
              {stage.label}
            </span>
          </span>
          <span className="relative flex h-14 items-center justify-center overflow-hidden rounded-lg bg-surface-soft/65 px-2">
            <span
              aria-hidden="true"
              className="block h-12 rounded-md"
              style={{
                background: isReference
                  ? "var(--tes-color-brand-lavender-soft)"
                  : [
                      "linear-gradient(100deg, var(--tes-color-brand-primary), var(--tes-color-brand-lavender))",
                      "linear-gradient(100deg, var(--tes-color-brand-cyan), var(--tes-color-brand-cyan-soft))",
                      "linear-gradient(100deg, var(--tes-color-status-success), var(--tes-color-brand-mint))",
                    ][index % 3],
                clipPath: "polygon(7% 0, 93% 0, 100% 100%, 0 100%)",
                width: isReference
                  ? `${96 - index * 18}%`
                  : stage.value === null || stage.value === 0
                    ? "0%"
                    : `${Math.max(24, (stage.value / maximum) * (96 - index * 12))}%`,
              }}
            />
          </span>
          <strong className="min-w-12 text-right text-sm text-tesText-secondary">
            {isReference || stage.value === null
              ? "—"
              : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format((stage.value / maximum) * 100)}%`}
          </strong>
        </li>
      ))}
    </ol>
  );
}

export function JourneyFunnel({
  stages,
}: {
  stages: Array<{ label: string; value: number | null }>;
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
