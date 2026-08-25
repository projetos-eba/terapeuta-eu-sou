"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { TherapistChartTooltip } from "@/features/therapist-metrics/components/therapist-chart-tooltip";

import type { TherapistDashboardPageData } from "../therapist-dashboard.types";

const COLORS = {
  cancelled: "var(--tes-color-status-danger)",
  completed: "var(--tes-color-brand-lavender)",
  scheduled: "var(--tes-color-brand-deep)",
};

export function TherapistWeekChart({
  days,
}: {
  days: TherapistDashboardPageData["week"]["days"];
}) {
  const summaryId = "therapist-week-chart-summary";

  return (
    <figure aria-describedby={summaryId} className="min-w-0">
      <div className="overflow-x-auto pb-2">
        <div className="h-[210px] min-w-[540px] w-full">
          <ResponsiveContainer height="100%" width="100%">
            <LineChart
              accessibilityLayer
              data={days}
              margin={{ bottom: 4, left: 2, right: 12, top: 8 }}
            >
              <CartesianGrid
                horizontal
                stroke="var(--tes-color-border)"
                strokeDasharray="4 5"
                vertical={false}
              />
              <XAxis
                axisLine={false}
                dataKey="date"
                tick={{
                  fill: "var(--tes-color-text-muted)",
                  fontSize: 11,
                  fontWeight: 700,
                }}
                tickFormatter={formatWeekdayLabel}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                domain={[0, "dataMax + 1"]}
                tick={{
                  fill: "var(--tes-color-text-muted)",
                  fontSize: 11,
                }}
                tickLine={false}
                width={24}
              />
              <Tooltip
                content={
                  <TherapistChartTooltip
                    labelFormatter={formatTooltipLabel}
                  />
                }
                cursor={{
                  stroke: "var(--tes-color-brand-lavender)",
                  strokeDasharray: "4 4",
                }}
                isAnimationActive={false}
              />
              <Line
                dataKey="scheduled"
                dot={{ fill: COLORS.scheduled, r: 3, strokeWidth: 0 }}
                isAnimationActive={false}
                name="Sessões agendadas"
                stroke={COLORS.scheduled}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                type="monotone"
              />
              <Line
                dataKey="completed"
                dot={{ fill: COLORS.completed, r: 3, strokeWidth: 0 }}
                isAnimationActive={false}
                name="Sessões realizadas"
                stroke={COLORS.completed}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                type="monotone"
              />
              <Line
                dataKey="cancelled"
                dot={{ fill: COLORS.cancelled, r: 3, strokeWidth: 0 }}
                isAnimationActive={false}
                name="Cancelamentos"
                stroke={COLORS.cancelled}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                type="monotone"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <figcaption className="sr-only" id={summaryId}>
        {days.length
          ? days
              .map(
                (day) =>
                  `${formatAccessibleDate(day.date)}: ${day.scheduled} agendadas, ${day.completed} realizadas e ${day.cancelled} cancelamentos.`,
              )
              .join(" ")
          : "Os dados da semana estão indisponíveis."}
      </figcaption>
    </figure>
  );
}

function formatAccessibleDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    weekday: "long",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatTooltipLabel(value: string | number) {
  const date = String(value);
  return `${formatWeekdayLabel(date)} · ${formatShortDate(date)}`;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

export function formatWeekdayLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "short",
  })
    .format(new Date(`${value}T12:00:00Z`))
    .replace(".", "")
    .toUpperCase();
}
