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

const colors = {
  cyan: "var(--tes-color-brand-cyan)",
  deep: "var(--tes-color-brand-deep)",
  lavender: "var(--tes-color-brand-lavender)",
  mint: "var(--tes-color-brand-mint)",
  primary: "var(--tes-color-brand-primary)",
  warning: "var(--tes-color-status-warning)",
};

export function MetricSparkline({
  data,
  label,
  tone = "primary",
}: {
  data: Array<{ label: string; value: number }>;
  label: string;
  tone?: "primary" | "warning";
}) {
  return (
    <div aria-label={label} className="h-12 w-full" role="img" tabIndex={0}>
      <ResponsiveContainer height="100%" width="100%">
        <LineChart
          accessibilityLayer
          data={data}
          margin={{ bottom: 2, left: 2, right: 2, top: 2 }}
        >
          <Line
            dataKey="value"
            dot={false}
            isAnimationActive={false}
            stroke={tone === "warning" ? colors.warning : colors.primary}
            strokeLinecap="round"
            strokeWidth={2.5}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SessionsEvolutionChart({
  points,
}: {
  points: Array<{
    date: string;
    previous?: number;
    sessionsCompleted: number;
  }>;
}) {
  return (
    <figure>
      <div
        aria-label="Evolução diária das sessões concluídas no período"
        className="h-[280px] w-full"
        role="img"
        tabIndex={0}
      >
        <ResponsiveContainer height="100%" width="100%">
          <AreaChart
            accessibilityLayer
            data={points}
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
              tickFormatter={shortDate}
              tickLine={false}
            />
            <YAxis allowDecimals={false} tickLine={false} width={34} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(value) => fullDate(String(value))}
            />
            <Area
              dataKey="sessionsCompleted"
              fill="url(#sessionsArea)"
              isAnimationActive={false}
              name="Sessões concluídas"
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
        Cada ponto representa sessões concluídas em um dia completo, no fuso
        horário da sua agenda.
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
            contentStyle={tooltipStyle}
            cursor={{ fill: "var(--tes-color-surface-soft)" }}
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
  items,
  label,
}: {
  centerLabel: string;
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
  return (
    <div>
      <div
        aria-label={label}
        className="relative mx-auto h-[220px] w-full max-w-[300px]"
        role="img"
        tabIndex={0}
      >
        <ResponsiveContainer height="100%" width="100%">
          <PieChart accessibilityLayer>
            <Pie
              data={items}
              dataKey="value"
              innerRadius="62%"
              isAnimationActive={false}
              nameKey="label"
              outerRadius="88%"
              paddingAngle={2}
            >
              {items.map((item, index) => (
                <Cell fill={palette[index % palette.length]} key={item.label} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-center text-sm font-extrabold text-brand-deep">
          {centerLabel}
        </span>
      </div>
      <ul className="mt-3 grid gap-2 text-sm font-semibold text-tesText-secondary">
        {items.map((item, index) => (
          <li
            className="flex items-center justify-between gap-3"
            key={item.label}
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full"
                style={{ background: palette[index % palette.length] }}
              />
              {item.label}
            </span>
            <strong className="text-brand-deep">{item.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MetricsHeatmap({
  points,
  valueLabel,
}: {
  points: Array<{ dayOfWeek: number; hourBucketStart: number; value: number }>;
  valueLabel: string;
}) {
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const hours = Array.from(
    new Set(points.map((point) => point.hourBucketStart)),
  ).sort((a, b) => a - b);
  const maximum = Math.max(1, ...points.map((point) => point.value));
  return (
    <div className="w-full min-w-0 pb-2">
      <table
        className="w-full table-fixed border-separate border-spacing-0.5 sm:border-spacing-1"
        aria-label={valueLabel}
      >
        <colgroup>
          <col className="w-10 sm:w-14" />
          {days.map((day) => (
            <col key={day} />
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
                key={day}
              >
                {day}
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
              {days.map((_, dayOfWeek) => {
                const point = points.find(
                  (item) =>
                    item.dayOfWeek === dayOfWeek &&
                    item.hourBucketStart === hour,
                );
                const value = point?.value ?? 0;
                const opacity =
                  value === 0 ? 0.08 : 0.2 + (value / maximum) * 0.8;
                return (
                  <td key={dayOfWeek}>
                    <span
                      aria-label={`${days[dayOfWeek]}, ${hour}h: ${value} ${valueLabel}`}
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
    </div>
  );
}

export function JourneyFunnel({
  stages,
}: {
  stages: Array<{ label: string; value: number }>;
}) {
  const maximum = Math.max(1, ...stages.map((stage) => stage.value));
  return (
    <ol aria-label="Jornada até o agendamento" className="grid gap-3">
      {stages.map((stage, index) => (
        <li
          className="grid gap-2 sm:grid-cols-[150px_1fr_auto] sm:items-center"
          key={stage.label}
        >
          <span className="text-sm font-extrabold text-brand-deep">
            {stage.label}
          </span>
          <span className="h-12 overflow-hidden rounded-lg bg-brand-lavenderSoft">
            <span
              aria-hidden="true"
              className="block h-full rounded-lg bg-gradient-to-r from-brand-lavender to-brand-primary"
              style={{
                width: `${Math.max(8, (stage.value / maximum) * (100 - index * 6))}%`,
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

const tooltipStyle = {
  background: "var(--tes-color-surface-default)",
  border: "1px solid var(--tes-color-brand-lavender)",
  borderRadius: 12,
  color: "var(--tes-color-text-primary)",
  fontSize: 13,
};

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
