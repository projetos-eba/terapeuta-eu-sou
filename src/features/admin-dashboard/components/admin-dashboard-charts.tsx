"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  AdminDashboardActivity,
  AdminDashboardFinancialOverview,
} from "../admin-dashboard.types";

const colors = {
  commission: "var(--tes-color-brand-lavender)",
  fees: "var(--tes-color-text-subtle)",
  netRevenue: "var(--tes-color-brand-primary)",
  patients: "var(--tes-color-brand-cyan)",
  professionals: "var(--tes-color-status-success)",
  sessions: "var(--tes-color-brand-primary)",
};

export function AdminActivityChart({
  activity,
}: {
  activity: AdminDashboardActivity;
}) {
  const description = activity.series
    .map(
      (point) =>
        `${point.label}: ${point.patients} pacientes, ${point.professionals} profissionais e ${point.sessions} sessões`,
    )
    .join("; ");

  return (
    <div
      aria-label={`Evolução da plataforma: ${description}`}
      className="h-[220px] w-full sm:h-[236px]"
      role="img"
      tabIndex={0}
    >
      <ResponsiveContainer height="100%" width="100%">
        <LineChart
          data={activity.series}
          margin={{ bottom: 0, left: -18, right: 6, top: 12 }}
        >
          <CartesianGrid
            stroke="var(--tes-color-brand-lavender)"
            strokeOpacity={0.62}
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="label"
            minTickGap={22}
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
            cursor={{ stroke: "var(--tes-color-brand-lavender)" }}
            formatter={(value) => formatInteger(Number(value))}
            isAnimationActive={false}
          />
          <Line
            dataKey="patients"
            dot={chartDot(colors.patients)}
            isAnimationActive={false}
            name="Pacientes cadastrados"
            stroke={colors.patients}
            strokeWidth={2.5}
            type="monotone"
          />
          <Line
            dataKey="professionals"
            dot={chartDot(colors.professionals)}
            isAnimationActive={false}
            name="Profissionais cadastrados"
            stroke={colors.professionals}
            strokeWidth={2.5}
            type="monotone"
          />
          <Line
            dataKey="sessions"
            dot={chartDot(colors.sessions)}
            isAnimationActive={false}
            name="Sessões criadas"
            stroke={colors.sessions}
            strokeWidth={2.7}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AdminFinancialChart({
  financial,
}: {
  financial: AdminDashboardFinancialOverview;
}) {
  const description = financial.series
    .map(
      (point) =>
        `${point.label}: receita líquida ${formatCurrency(point.netRevenueCents)}, comissão bruta ${formatCurrency(point.grossCommissionCents)} e taxas Stripe ${formatCurrency(point.stripeFeesCents)}`,
    )
    .join("; ");

  return (
    <div
      aria-label={`Resultado financeiro: ${description}`}
      className="h-[190px] w-full sm:h-[204px]"
      role="img"
      tabIndex={0}
    >
      <ResponsiveContainer height="100%" width="100%">
        <BarChart
          barCategoryGap="24%"
          data={financial.series}
          margin={{ bottom: 0, left: -14, right: 4, top: 10 }}
        >
          <CartesianGrid
            stroke="var(--tes-color-brand-lavender)"
            strokeOpacity={0.58}
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="label"
            minTickGap={22}
            tick={{ fill: "var(--tes-color-text-muted)", fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fill: "var(--tes-color-brand-primary)", fontSize: 11 }}
            tickFormatter={formatCompactCurrency}
            tickLine={false}
            width={52}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "var(--tes-color-brand-lavenderSoft)" }}
            formatter={(value) => formatCurrency(Number(value))}
            isAnimationActive={false}
          />
          <Bar
            dataKey="netRevenueCents"
            fill={colors.netRevenue}
            isAnimationActive={false}
            name="Receita líquida"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="grossCommissionCents"
            fill={colors.commission}
            isAnimationActive={false}
            name="Comissão bruta"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="stripeFeesCents"
            fill={colors.fees}
            isAnimationActive={false}
            name="Taxas Stripe"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function chartDot(color: string) {
  return {
    fill: "white",
    r: 3.5,
    stroke: color,
    strokeWidth: 2,
  };
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatCurrency(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(valueInCents / 100);
}

function formatCompactCurrency(valueInCents: number) {
  const value = valueInCents / 100;

  if (Math.abs(value) >= 1000) {
    return `R$ ${new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 0,
      notation: "compact",
    }).format(value)}`;
  }

  return `R$ ${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

const tooltipStyle = {
  border: "1px solid var(--tes-color-brand-lavender)",
  borderRadius: "12px",
  boxShadow: "0 14px 30px rgba(20, 16, 90, 0.14)",
  color: "var(--tes-color-brand-deep)",
  fontSize: 12,
  fontWeight: 700,
};
