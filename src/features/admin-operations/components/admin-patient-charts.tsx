"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AdminPatientAnalytics } from "../admin-operations.types";

const colors = {
  newRegistrations: "var(--tes-color-brand-lavender)",
  totalClients: "var(--tes-color-brand-primary)",
};

export function AdminPatientGrowthChart({
  series,
}: {
  series: AdminPatientAnalytics["series"];
}) {
  const hasMounted = useChartMount();
  const description = series
    .map(
      (point) =>
        `${point.label}: ${point.totalClients} clientes no total e ${point.newRegistrations} novos cadastros`,
    )
    .join("; ");

  return (
    <div
      aria-label={`Evolução de clientes: ${description}`}
      className="h-[236px] w-full sm:h-[252px]"
      role="img"
      tabIndex={0}
    >
      {hasMounted ? (
        <ResponsiveContainer height="100%" width="100%">
          <ComposedChart
            data={series}
            margin={{ bottom: 0, left: -18, right: 8, top: 12 }}
          >
            <CartesianGrid
              stroke="var(--tes-color-brand-lavender)"
              strokeOpacity={0.58}
              vertical={false}
            />
            <XAxis
              axisLine={false}
              dataKey="label"
              minTickGap={24}
              tick={{ fill: "var(--tes-color-text-muted)", fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tick={{ fill: "var(--tes-color-brand-primary)", fontSize: 11 }}
              tickLine={false}
              width={38}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "var(--tes-color-brand-lavenderSoft)" }}
              formatter={(value) => formatInteger(Number(value))}
              isAnimationActive={false}
            />
            <Bar
              dataKey="newRegistrations"
              fill={colors.newRegistrations}
              fillOpacity={0.74}
              isAnimationActive={false}
              name="Novos cadastros"
              radius={[4, 4, 0, 0]}
            />
            <Line
              dataKey="totalClients"
              dot={{
                fill: "white",
                r: 3,
                stroke: colors.totalClients,
                strokeWidth: 2,
              }}
              isAnimationActive={false}
              name="Total acumulado"
              stroke={colors.totalClients}
              strokeWidth={2.75}
              type="monotone"
            />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <StaticGrowthChart series={series} />
      )}
    </div>
  );
}

export function AdminPatientActivityAgeChart({
  activityAge,
}: {
  activityAge: AdminPatientAnalytics["activityAge"];
}) {
  const hasMounted = useChartMount();
  const description = activityAge
    .map((bucket) => `${bucket.label}: ${bucket.value} clientes`)
    .join("; ");

  return (
    <div
      aria-label={`Tempo desde a última atividade: ${description}`}
      className="h-[236px] w-full sm:h-[252px]"
      role="img"
      tabIndex={0}
    >
      {hasMounted ? (
        <ResponsiveContainer height="100%" width="100%">
          <ComposedChart
            data={activityAge}
            margin={{ bottom: 0, left: -18, right: 8, top: 12 }}
          >
            <CartesianGrid
              stroke="var(--tes-color-brand-lavender)"
              strokeOpacity={0.58}
              vertical={false}
            />
            <XAxis
              axisLine={false}
              dataKey="label"
              interval={0}
              tick={{ fill: "var(--tes-color-text-muted)", fontSize: 10 }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tick={{ fill: "var(--tes-color-brand-primary)", fontSize: 11 }}
              tickLine={false}
              width={38}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "var(--tes-color-brand-lavenderSoft)" }}
              formatter={(value) => formatInteger(Number(value))}
              isAnimationActive={false}
            />
            <Bar
              dataKey="value"
              fill="var(--tes-color-brand-primary)"
              fillOpacity={0.78}
              isAnimationActive={false}
              name="Clientes"
              radius={[5, 5, 0, 0]}
            />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <StaticActivityAgeChart activityAge={activityAge} />
      )}
    </div>
  );
}

function useChartMount() {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  return hasMounted;
}

function StaticGrowthChart({
  series,
}: {
  series: AdminPatientAnalytics["series"];
}) {
  const maximum = Math.max(
    1,
    ...series.flatMap((point) => [point.newRegistrations, point.totalClients]),
  );
  const chart = { bottom: 194, height: 150, left: 44, right: 584, top: 22 };
  const step =
    series.length > 1 ? (chart.right - chart.left) / (series.length - 1) : 0;
  const y = (value: number) => chart.bottom - (value / maximum) * chart.height;
  const linePoints = series
    .map(
      (point, index) => `${chart.left + index * step},${y(point.totalClients)}`,
    )
    .join(" ");

  return (
    <svg
      aria-hidden="true"
      className="h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 620 232"
    >
      {[0, 1, 2, 3].map((stepIndex) => {
        const gridY = chart.top + (chart.height / 3) * stepIndex;
        return (
          <line
            key={stepIndex}
            stroke="var(--tes-color-brand-lavender)"
            strokeOpacity="0.58"
            x1={chart.left}
            x2={chart.right}
            y1={gridY}
            y2={gridY}
          />
        );
      })}
      {series.map((point, index) => {
        const x = chart.left + index * step;
        const barHeight = Math.max(2, chart.bottom - y(point.newRegistrations));
        return (
          <g key={point.label}>
            <rect
              fill={colors.newRegistrations}
              fillOpacity="0.74"
              height={barHeight}
              rx="4"
              width="18"
              x={x - 9}
              y={chart.bottom - barHeight}
            />
            <text
              fill="var(--tes-color-text-muted)"
              fontSize="11"
              textAnchor="middle"
              x={x}
              y="218"
            >
              {point.label}
            </text>
          </g>
        );
      })}
      <polyline
        fill="none"
        points={linePoints}
        stroke={colors.totalClients}
        strokeWidth="3"
      />
      {series.map((point, index) => (
        <circle
          cx={chart.left + index * step}
          cy={y(point.totalClients)}
          fill="white"
          key={`${point.label}-point`}
          r="4"
          stroke={colors.totalClients}
          strokeWidth="2.5"
        />
      ))}
    </svg>
  );
}

function StaticActivityAgeChart({
  activityAge,
}: {
  activityAge: AdminPatientAnalytics["activityAge"];
}) {
  const maximum = Math.max(1, ...activityAge.map((bucket) => bucket.value));
  const chart = { bottom: 184, height: 142, left: 36, right: 594, top: 22 };
  const step = activityAge.length
    ? (chart.right - chart.left) / activityAge.length
    : 0;

  return (
    <svg
      aria-hidden="true"
      className="h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 620 232"
    >
      {[0, 1, 2, 3].map((stepIndex) => {
        const gridY = chart.top + (chart.height / 3) * stepIndex;
        return (
          <line
            key={stepIndex}
            stroke="var(--tes-color-brand-lavender)"
            strokeOpacity="0.58"
            x1={chart.left}
            x2={chart.right}
            y1={gridY}
            y2={gridY}
          />
        );
      })}
      {activityAge.map((bucket, index) => {
        const x = chart.left + index * step + step * 0.18;
        const width = step * 0.64;
        const height = Math.max(2, (bucket.value / maximum) * chart.height);
        const label = bucket.label.replace(" dias", "");
        return (
          <g key={bucket.label}>
            <rect
              fill="var(--tes-color-brand-primary)"
              fillOpacity={0.78 - index * 0.09}
              height={height}
              rx="6"
              width={width}
              x={x}
              y={chart.bottom - height}
            />
            <text
              fill="var(--tes-color-brand-deep)"
              fontSize="11"
              fontWeight="700"
              textAnchor="middle"
              x={x + width / 2}
              y={chart.bottom - height - 8}
            >
              {formatInteger(bucket.value)}
            </text>
            <text
              fill="var(--tes-color-text-muted)"
              fontSize="9"
              textAnchor="middle"
              x={x + width / 2}
              y="204"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

const tooltipStyle = {
  border: "1px solid var(--tes-color-brand-lavender)",
  borderRadius: "12px",
  boxShadow: "0 14px 30px rgba(20, 16, 90, 0.14)",
  color: "var(--tes-color-brand-deep)",
  fontSize: 12,
  fontWeight: 700,
};
