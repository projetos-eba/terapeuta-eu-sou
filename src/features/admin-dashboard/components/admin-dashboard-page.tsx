import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  HeartPulse,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react";

import { routes } from "@/lib/routes";

import type {
  AdminDashboard,
  AdminDashboardAlert,
  AdminDashboardMetric,
  AdminDashboardModule,
} from "../admin-dashboard.types";

type DashboardMetricWithFallback = AdminDashboardMetric & {
  icon: "calendar" | "heart" | "payments" | "therapist" | "users";
};

type AvailableMetric = AdminDashboardMetric & { value: number };

type BreakdownItem = {
  colorClass: string;
  href?: string;
  label: string;
  status: AdminDashboardModule["status"];
  value: number;
};

type FunnelStep = AvailableMetric & {
  colorClass: string;
};

type HealthRow = {
  label: string;
  tone: AdminDashboardMetric["tone"] | AdminDashboardAlert["severity"];
  value: string;
};

const DONUT_COLORS = [
  "bg-brand-primary",
  "bg-brand-cyan",
  "bg-status-warning",
  "bg-status-danger",
  "bg-brand-lavender",
];

const FUNNEL_COLORS = [
  "bg-brand-primary",
  "bg-status-info",
  "bg-brand-mint",
  "bg-status-danger",
  "bg-brand-lavender",
];

type AdminDashboardPageProps = {
  dashboard: AdminDashboard;
};

export function AdminDashboardPage({ dashboard }: AdminDashboardPageProps) {
  const allMetrics = dashboard.modules.flatMap((module) => module.metrics);
  const kpis = buildDashboardKpis(allMetrics);
  const chartMetrics = buildChartMetrics(allMetrics);
  const moduleBreakdown = buildModuleBreakdown(dashboard.modules);
  const funnelSteps = buildFunnelSteps(allMetrics);

  return (
    <main className="min-h-screen overflow-hidden bg-background px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 20% 10%, color-mix(in srgb, var(--tes-color-brand-lavender) 42%, transparent), transparent 32%), radial-gradient(circle at 80% 18%, color-mix(in srgb, var(--tes-color-brand-cyan) 16%, transparent), transparent 28%), linear-gradient(180deg, color-mix(in srgb, var(--tes-color-surface-soft) 62%, transparent), color-mix(in srgb, var(--tes-color-surface-default) 96%, transparent))",
        }}
      />
      <div className="mx-auto w-full max-w-[1166px] space-y-7">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.42em] text-brand-primary">
              Admin
            </p>
            <h1 className="mt-3 font-display text-[3.35rem] font-normal italic leading-[0.95] text-brand-deep sm:text-[4.1rem]">
              Visão geral
            </h1>
            <p className="mt-4 max-w-[860px] text-base font-semibold leading-7 text-tesText-secondary sm:text-lg">
              Acompanhe a saúde da plataforma, as operações e os principais
              indicadores de crescimento.
            </p>
          </div>
          <p className="w-fit rounded-full border border-brand-lavender/70 bg-white/85 px-5 py-3 text-sm font-extrabold text-tesText-secondary shadow-[0_18px_45px_rgba(20,16,90,0.08)] backdrop-blur">
            Atualizado em {formatDateTime(dashboard.generatedAt)}
          </p>
        </header>

        <section
          aria-label="Indicadores principais"
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        >
          {kpis.map((metric) => (
            <SummaryMetricCard key={metric.key} metric={metric} />
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.88fr)]">
          <EvolutionPanel metrics={chartMetrics} />
          <DistributionPanel items={moduleBreakdown} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[390px_340px]">
          <OperationalFunnelPanel steps={funnelSteps} />
          <PlatformHealthPanel
            alerts={dashboard.alerts}
            metrics={allMetrics}
            modules={dashboard.modules}
          />
        </section>
      </div>
    </main>
  );
}

function SummaryMetricCard({ metric }: { metric: DashboardMetricWithFallback }) {
  const Icon = iconForMetric(metric.icon);

  return (
    <article className="min-h-[214px] rounded-[20px] border border-brand-lavender/80 bg-white p-6 shadow-[0_18px_34px_rgba(108,61,145,0.07)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_46px_rgba(108,61,145,0.11)]">
      <div className="flex h-full flex-col justify-between gap-7">
        <div className="flex items-start gap-3">
          <span
            className={`grid size-[46px] shrink-0 place-items-center rounded-[18px] ${metricIconClass(
              metric,
            )}`}
          >
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <h2 className="pt-1 text-base font-extrabold leading-[1.08] text-brand-deep">
            {metric.label}
          </h2>
        </div>
        <div>
          <p className="text-[2rem] font-extrabold leading-none tracking-[-0.03em] text-brand-deep">
            {formatMetricValue(metric)}
          </p>
          <StatusPill className="mt-3" tone={metric.tone}>
            Disponível
          </StatusPill>
          <p className="mt-3 text-xs font-bold leading-5 text-tesText-muted">
            {metric.description}
          </p>
        </div>
      </div>
    </article>
  );
}

function EvolutionPanel({ metrics }: { metrics: AvailableMetric[] }) {
  const max = Math.max(...metrics.map((metric) => metric.value), 1);
  const chartTooltipLines = buildChartTooltipLines(metrics);
  const points = metrics.map((metric, index) => {
    const x = metrics.length === 1 ? 260 : 60 + index * (420 / (metrics.length - 1));
    const y = 185 - (metric.value / max) * 132;

    return { ...metric, x, y };
  });
  const path = buildLinePath(points);
  const areaPath =
    points.length > 1
      ? `${path} L ${points[points.length - 1].x} 190 L ${points[0].x} 190 Z`
      : "";

  return (
    <article className="min-h-[437px] rounded-[20px] border border-brand-lavender/80 bg-white p-6 shadow-[0_18px_42px_rgba(108,61,145,0.08)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold leading-tight text-brand-deep">
            Evolução da plataforma
          </h2>
          <div className="mt-5 flex flex-wrap gap-5">
            {metrics.slice(0, 3).map((metric) => (
              <span
                className="inline-flex items-center gap-2 text-xs font-extrabold text-tesText-secondary"
                key={metric.key}
              >
                <span className={`size-2.5 rounded-full ${dotClass(metric.tone)}`} />
                {metric.label}
              </span>
            ))}
          </div>
        </div>
        <span className="w-fit rounded-full bg-white px-4 py-2 text-xs font-extrabold text-brand-primary shadow-[0_8px_24px_rgba(20,16,90,0.07)]">
          Indicadores atuais
        </span>
      </div>

      {points.length > 0 ? (
        <>
          <div
            className="relative z-0 mt-7 overflow-visible rounded-[18px]"
            style={{
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--tes-color-surface-soft) 72%, transparent), transparent)",
            }}
          >
            <svg
              aria-label="Comparativo visual dos indicadores atuais da plataforma"
              className="h-[220px] w-full overflow-visible"
              role="img"
              viewBox="0 0 520 220"
            >
              <defs>
                <linearGradient id="admin-dashboard-line" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="var(--tes-color-brand-primary)" />
                  <stop offset="52%" stopColor="var(--tes-color-status-info)" />
                  <stop offset="100%" stopColor="var(--tes-color-status-success)" />
                </linearGradient>
                <linearGradient id="admin-dashboard-area" x1="0" x2="0" y1="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--tes-color-brand-lavender)"
                    stopOpacity="0.42"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--tes-color-brand-lavender)"
                    stopOpacity="0"
                  />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3, 4].map((line) => (
                <line
                  key={line}
                  stroke="var(--tes-color-brand-lavender)"
                  strokeOpacity="0.58"
                  strokeWidth="1.2"
                  x1="42"
                  x2="492"
                  y1={52 + line * 34}
                  y2={52 + line * 34}
                />
              ))}
              {areaPath ? <path d={areaPath} fill="url(#admin-dashboard-area)" /> : null}
              {path ? (
                <path
                  d={path}
                  fill="none"
                  stroke="url(#admin-dashboard-line)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="5"
                />
              ) : null}
              {points.map((point) => (
                <LineChartPoint
                  key={point.key}
                  point={point}
                />
              ))}
              <text
                fill="var(--tes-color-brand-primary)"
                fontSize="12"
                fontWeight="800"
                x="10"
                y="57"
              >
                {formatNumber(max)}
              </text>
              <text
                fill="var(--tes-color-brand-primary)"
                fontSize="12"
                fontWeight="800"
                x="24"
                y="193"
              >
                0
              </text>
              <g className="admin-dashboard-chart-tooltips">
                {points.map((point) => (
                  <LineChartTooltip
                    key={`${point.key}-tooltip`}
                    point={point}
                    tooltipLines={chartTooltipLines}
                  />
                ))}
              </g>
            </svg>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {metrics.slice(0, 3).map((metric) => (
              <MiniMetricTile key={metric.key} metric={metric} />
            ))}
          </div>
        </>
      ) : (
        <UnavailableState>
          Ainda não há indicadores suficientes para montar esta visão.
        </UnavailableState>
      )}
    </article>
  );
}

function MiniMetricTile({ metric }: { metric: AvailableMetric }) {
  return (
    <div className="rounded-[14px] border border-brand-lavender/80 bg-white px-4 py-3 shadow-[0_12px_22px_rgba(108,61,145,0.04)]">
      <p className="text-xs font-extrabold text-tesText-secondary">
        {metric.label}
      </p>
      <p className="mt-2 text-lg font-extrabold leading-none text-brand-deep">
        {formatNumber(metric.value)}
      </p>
    </div>
  );
}

function LineChartPoint({
  point,
}: {
  point: AvailableMetric & { x: number; y: number };
}) {
  return (
    <g>
      <circle
        cx={point.x}
        cy={point.y}
        fill="white"
        r="8"
        stroke="url(#admin-dashboard-line)"
        strokeWidth="4"
      />
      <text
        fill="var(--tes-color-text-muted)"
        fontSize="11"
        fontWeight="800"
        textAnchor="middle"
        x={point.x}
        y="213"
      >
        {shortMetricLabel(point)}
      </text>
    </g>
  );
}

function LineChartTooltip({
  point,
  tooltipLines,
}: {
  point: AvailableMetric & { x: number; y: number };
  tooltipLines: string[];
}) {
  return (
    <g className="group outline-none" tabIndex={0}>
      <circle
        className="cursor-help"
        cx={point.x}
        cy={point.y}
        fill="transparent"
        pointerEvents="all"
        r="19"
      />
      <SvgTooltip
        lines={tooltipLines}
        viewBoxWidth={520}
        x={point.x}
        y={point.y}
      />
    </g>
  );
}

function DistributionPanel({ items }: { items: BreakdownItem[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <article className="min-h-[437px] rounded-[20px] border border-brand-lavender/80 bg-white p-7 shadow-[0_18px_42px_rgba(108,61,145,0.08)]">
      <h2 className="max-w-[360px] text-2xl font-extrabold leading-tight text-brand-deep">
        Distribuição operacional
      </h2>
      <p className="mt-2 text-sm font-bold leading-6 text-tesText-muted">
        Volume por área administrativa.
      </p>

      {total > 0 ? (
        <div className="mt-7 grid items-center gap-7 sm:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[220px_minmax(0,1fr)]">
          <DonutChart items={items} total={total} />
          <div className="space-y-4">
            {items.map((item) => (
              <DistributionItem item={item} key={item.label} total={total} />
            ))}
          </div>
        </div>
      ) : (
        <UnavailableState>
          Ainda não há volume suficiente para distribuir por área.
        </UnavailableState>
      )}
    </article>
  );
}

function OperationalFunnelPanel({ steps }: { steps: FunnelStep[] }) {
  return (
    <article className="min-h-[373px] rounded-[20px] border border-brand-lavender/80 bg-white p-6 shadow-[0_18px_42px_rgba(108,61,145,0.08)]">
      <h2 className="text-xl font-extrabold leading-tight text-brand-deep">
        Funil operacional
      </h2>

      {steps.length > 0 ? (
        <>
          <div className="mt-7 grid gap-6 sm:grid-cols-[174px_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[174px_minmax(0,1fr)]">
            <div className="space-y-2 pt-1">
              {steps.map((step, index) => (
                <div
                  aria-label={funnelTooltip(step, steps[0].value)}
                  className="group relative mx-auto outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
                  key={step.key}
                  tabIndex={0}
                  style={{
                    width: `${Math.max(56, 174 - index * 28)}px`,
                  }}
                >
                  <div
                    aria-hidden="true"
                    className={`h-[36px] ${step.colorClass}`}
                    style={{
                      clipPath: "polygon(8% 0, 92% 0, 82% 100%, 18% 100%)",
                      opacity: 1 - index * 0.04,
                    }}
                  />
                  <TooltipBubble>
                    {funnelTooltip(step, steps[0].value)}
                  </TooltipBubble>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              {steps.map((step) => (
                <div
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-3"
                  key={step.key}
                >
                  <span className="text-sm font-extrabold leading-tight text-tesText-secondary">
                    {step.label}
                  </span>
                  <span className="text-right text-sm font-extrabold text-brand-deep">
                    {formatNumber(step.value)}
                    <span className="mt-1 block rounded-full bg-brand-lavenderSoft px-2 py-1 text-[0.65rem] font-extrabold text-brand-primary">
                      {formatPercent(step.value, steps[0].value)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <StaticCardFooter>
            Acompanhamento calculado com os indicadores disponíveis.
          </StaticCardFooter>
        </>
      ) : (
        <UnavailableState>
          Ainda não há indicadores suficientes para acompanhar o funil.
        </UnavailableState>
      )}
    </article>
  );
}

function PlatformHealthPanel({
  alerts,
  metrics,
  modules,
}: {
  alerts: AdminDashboardAlert[];
  metrics: AdminDashboardMetric[];
  modules: AdminDashboardModule[];
}) {
  const healthRows = buildHealthRows({ alerts, metrics, modules });

  return (
    <article className="min-h-[373px] rounded-[20px] border border-brand-lavender/80 bg-white p-6 shadow-[0_18px_42px_rgba(108,61,145,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <h2 className="max-w-[190px] text-xl font-extrabold leading-tight text-brand-deep">
          Saúde da plataforma
        </h2>
        <span className="rounded-full bg-white px-3 py-2 text-[0.68rem] font-extrabold text-brand-primary shadow-[0_8px_24px_rgba(20,16,90,0.07)]">
          Hoje
        </span>
      </div>

      <div className="mt-7 divide-y divide-brand-lavender/70">
        {healthRows.map((row) => (
          <div
            className="flex min-h-[45px] items-center justify-between gap-4 py-3"
            key={row.label}
          >
            <span className="text-sm font-extrabold leading-tight text-tesText-secondary">
              {row.label}
            </span>
            <StatusPill tone={row.tone}>{row.value}</StatusPill>
          </div>
        ))}
      </div>

      {alerts.length > 0 ? (
        <div className="mt-4 space-y-2">
          {alerts.slice(0, 1).map((alert) => (
            <AlertItem alert={alert} key={alert.key} />
          ))}
        </div>
      ) : null}

      <StaticCardFooter>
        Alertas acionáveis aparecem acima com destino específico.
      </StaticCardFooter>
    </article>
  );
}

function DistributionItem({
  item,
  total,
}: {
  item: BreakdownItem;
  total: number;
}) {
  const content = (
    <>
      <span className="flex items-start gap-3 text-sm font-extrabold leading-tight text-brand-deep">
        <span className={`mt-1 size-3.5 rounded-full ${item.colorClass}`} />
        <span>
          {item.label}
          <span className="mt-1 block text-xs font-bold text-tesText-secondary">
            {formatNumber(item.value)} ({formatPercent(item.value, total)})
          </span>
        </span>
      </span>
      {item.href ? (
        <ArrowRight
          aria-hidden="true"
          className="mt-1 size-4 text-brand-primary opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
        />
      ) : null}
    </>
  );

  if (!item.href) {
    return (
      <div className="flex items-start justify-between gap-4 rounded-[16px] px-3 py-2">
        {content}
      </div>
    );
  }

  return (
    <Link
      className="group flex items-start justify-between gap-4 rounded-[16px] px-3 py-2 outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
      href={item.href as Route<string>}
    >
      {content}
    </Link>
  );
}

function DonutChart({
  items,
  total,
}: {
  items: BreakdownItem[];
  total: number;
}) {
  const segments = buildDonutSegments(items, total);

  return (
    <div className="relative mx-auto grid size-[220px] place-items-center">
      <svg
        aria-label={`Distribuição com ${formatNumber(total)} itens no total`}
        className="absolute inset-0 z-10 size-full overflow-visible"
        role="img"
        viewBox="0 0 220 220"
      >
        {segments.map((segment) => (
          <path d={segment.path} fill={segment.color} key={segment.label} />
        ))}
        {segments.map((segment) => (
          <g
            className="group outline-none"
            key={`${segment.label}-tooltip`}
            tabIndex={0}
          >
            <path className="cursor-help" d={segment.path} fill="transparent" />
            <SvgTooltip
              lines={segment.tooltipLines}
              viewBoxWidth={220}
              x={segment.tooltipX}
              y={segment.tooltipY}
            />
          </g>
        ))}
      </svg>
      <div className="pointer-events-none relative z-0 grid size-[112px] place-items-center rounded-full bg-white text-center shadow-[0_10px_28px_rgba(20,16,90,0.06)]">
        <span className="text-2xl font-extrabold text-brand-deep">
          {formatNumber(total)}
        </span>
      </div>
    </div>
  );
}

function TooltipBubble({ children }: { children: ReactNode }) {
  return (
    <span
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[260px] -translate-x-1/2 rounded-[14px] bg-brand-deep px-4 py-3 text-left text-sm font-extrabold leading-5 text-white opacity-0 shadow-[0_18px_38px_rgba(20,16,90,0.18)] transition duration-150 group-hover:translate-y-[-2px] group-hover:opacity-100 group-focus-visible:translate-y-[-2px] group-focus-visible:opacity-100"
      role="tooltip"
    >
      {children}
    </span>
  );
}

function SvgTooltip({
  lines,
  viewBoxWidth,
  x,
  y,
}: {
  lines: string[];
  viewBoxWidth: number;
  x: number;
  y: number;
}) {
  const width = Math.min(190, viewBoxWidth - 12);
  const height = 28 + lines.length * 16;
  const left = clamp(x - width / 2, 6, viewBoxWidth - width - 6);
  const top = y > height + 22 ? y - height - 14 : y + 18;

  return (
    <g className="pointer-events-none opacity-0 drop-shadow-sm transition duration-150 group-hover:opacity-100 group-focus:opacity-100">
      <rect
        fill="var(--tes-color-brand-deep)"
        height={height}
        rx="12"
        width={width}
        x={left}
        y={top}
      />
      <text
        fill="white"
        fontSize="13"
        fontWeight="800"
        x={left + 12}
        y={top + 21}
      >
        {lines.map((line, index) => (
          <tspan dy={index === 0 ? 0 : 16} key={line} x={left + 12}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function AlertItem({ alert }: { alert: AdminDashboardAlert }) {
  return (
    <Link
      className="flex items-start gap-3 rounded-[16px] bg-surface-soft p-3 outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
      href={(alert.href ?? routes.admin.home) as Route<string>}
    >
      <AlertTriangle
        aria-hidden="true"
        className={`mt-0.5 size-4 shrink-0 ${alertIconClass(alert.severity)}`}
      />
      <span>
        <span className="block text-sm font-extrabold text-brand-deep">
          {alert.label}
        </span>
        <span className="mt-1 block text-xs font-bold leading-5 text-tesText-secondary">
          {alert.description}
        </span>
      </span>
    </Link>
  );
}

function StaticCardFooter({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <p className="mt-7 border-t border-brand-lavender/70 pt-5 text-center text-sm font-extrabold leading-6 text-tesText-secondary">
      {children}
    </p>
  );
}

function StatusPill({
  children,
  className = "",
  tone,
}: {
  children: ReactNode;
  className?: string;
  tone: AdminDashboardMetric["tone"] | AdminDashboardAlert["severity"];
}) {
  return (
    <span
      className={`inline-flex min-h-6 items-center justify-center rounded-full px-3 text-[0.68rem] font-extrabold ${
        statusPillClass(tone)
      } ${className}`}
    >
      {children}
    </span>
  );
}

function UnavailableState({ children }: { children: ReactNode }) {
  return (
    <div className="mt-7 rounded-[20px] border border-dashed border-brand-lavender bg-surface-soft p-5 text-sm font-bold leading-6 text-tesText-secondary">
      {children}
    </div>
  );
}

function buildDashboardKpis(
  metrics: AdminDashboardMetric[],
): DashboardMetricWithFallback[] {
  return [
    withIcon(findMetric(metrics, "active-therapists"), "therapist"),
    withIcon(findMetric(metrics, "active-patients"), "users"),
    withIcon(findMetric(metrics, "future-sessions"), "calendar"),
    withIcon(findMetric(metrics, "paid-session-payments"), "payments"),
    withIcon(findMetric(metrics, "active-subscriptions"), "heart"),
  ].filter(Boolean) as DashboardMetricWithFallback[];
}

function buildChartMetrics(metrics: AdminDashboardMetric[]) {
  return [
    findMetric(metrics, "active-patients"),
    findMetric(metrics, "active-therapists"),
    findMetric(metrics, "future-sessions"),
    findMetric(metrics, "paid-session-payments"),
    findMetric(metrics, "active-subscriptions"),
  ].filter(isAvailableMetric);
}

function buildFunnelSteps(metrics: AdminDashboardMetric[]) {
  return [
    findMetric(metrics, "active-patients"),
    findMetric(metrics, "active-therapists"),
    findMetric(metrics, "future-sessions"),
    findMetric(metrics, "paid-session-payments"),
    findMetric(metrics, "active-subscriptions"),
  ]
    .filter(isAvailableMetric)
    .map((metric, index) => ({
      ...metric,
      colorClass: FUNNEL_COLORS[index % FUNNEL_COLORS.length],
    }));
}

function buildHealthRows({
  alerts,
  metrics,
  modules,
}: {
  alerts: AdminDashboardAlert[];
  metrics: AdminDashboardMetric[];
  modules: AdminDashboardModule[];
}): HealthRow[] {
  const readyModules = modules.filter((module) => module.status === "ready").length;
  const totalModules = Math.max(modules.length, 1);
  const openSupport = findMetric(metrics, "open-support-tickets");
  const attentionSessions = findMetric(metrics, "attention-sessions");
  const pendingTherapists = findMetric(metrics, "pending-therapists");
  const criticalAlerts = alerts.filter((alert) => alert.severity === "critical");

  return [
    {
      label: "Módulos operacionais",
      tone: readyModules === modules.length ? "success" : "warning",
      value: `${readyModules}/${totalModules}`,
    },
    {
      label: "Alertas críticos",
      tone: criticalAlerts.length === 0 ? "success" : "danger",
      value: formatNumber(criticalAlerts.length),
    },
    {
      label: "Sessões com atenção",
      tone: hasPositiveValue(attentionSessions) ? "warning" : "success",
      value: formatMetricValue(attentionSessions),
    },
    {
      label: "Profissionais pendentes",
      tone: hasPositiveValue(pendingTherapists) ? "warning" : "success",
      value: formatMetricValue(pendingTherapists),
    },
    {
      label: "Chamados abertos",
      tone: hasPositiveValue(openSupport) ? "warning" : "success",
      value: formatMetricValue(openSupport),
    },
  ];
}

function buildModuleBreakdown(modules: AdminDashboardModule[]) {
  return modules.map((module, index) => ({
    colorClass: DONUT_COLORS[index % DONUT_COLORS.length],
    href: getDashboardModuleHref(module),
    label: module.label,
    status: module.status,
    value: module.metrics.reduce(
      (sum, metric) =>
        metric.status === "available" && metric.value !== null
          ? sum + metric.value
          : sum,
      0,
    ),
  }));
}

function getDashboardModuleHref(module: AdminDashboardModule) {
  if (module.key === "catalog") return routes.admin.therapies;
  if (module.key === "finance") return routes.admin.payments;
  if (module.key === "operation") return routes.admin.sessions;
  if (module.key === "settings") return routes.admin.settings;

  return undefined;
}

function findMetric(metrics: AdminDashboardMetric[], key: string) {
  return metrics.find((metric) => metric.key === key);
}

function withIcon(
  metric: AdminDashboardMetric | undefined,
  icon: DashboardMetricWithFallback["icon"],
) {
  return metric ? { ...metric, icon } : null;
}

function isAvailableMetric(
  metric: AdminDashboardMetric | undefined,
): metric is AvailableMetric {
  return Boolean(
    metric && metric.status === "available" && metric.value !== null,
  );
}

function hasPositiveValue(metric: AdminDashboardMetric | undefined) {
  return isAvailableMetric(metric) && metric.value > 0;
}

function buildLinePath(points: Array<AvailableMetric & { x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;

    const previous = points[index - 1];
    const controlX = previous.x + (point.x - previous.x) / 2;

    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
}

function buildChartTooltipLines(metrics: AvailableMetric[]) {
  return [
    "Indicadores atuais",
    ...metrics.map(
      (metric) => `${shortMetricLabel(metric)}: ${formatNumber(metric.value)}`,
    ),
  ];
}

function buildDonutSegments(items: BreakdownItem[], total: number) {
  let accumulated = 0;

  return items
    .filter((item) => item.value > 0)
    .map((item) => {
      const startAngle = (accumulated / total) * 360;
      accumulated += item.value;
      const endAngle = Math.min((accumulated / total) * 360, 359.99);
      const midpoint = polarToCartesian(
        110,
        110,
        96,
        startAngle + (endAngle - startAngle) / 2,
      );

      return {
        color: chartColor(item.colorClass),
        label: item.label,
        path: describeDonutSegment(110, 110, 82, 56, startAngle, endAngle),
        tooltipLines: [
          item.label,
          `${formatNumber(item.value)} itens`,
          `${formatPercent(item.value, total)} do volume`,
        ],
        tooltipX: midpoint.x,
        tooltipY: midpoint.y,
      };
    });
}

function describeDonutSegment(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
) {
  const outerStart = polarToCartesian(cx, cy, outerRadius, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ");
}

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleInDegrees: number,
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;

  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function chartColor(colorClass: string) {
  const colorMap: Record<string, string> = {
    "bg-brand-cyan": "var(--tes-color-brand-cyan)",
    "bg-brand-lavender": "var(--tes-color-brand-lavender)",
    "bg-brand-primary": "var(--tes-color-brand-primary)",
    "bg-status-danger": "var(--tes-color-status-danger)",
    "bg-status-info": "var(--tes-color-status-info)",
    "bg-status-success": "var(--tes-color-status-success)",
    "bg-status-warning": "var(--tes-color-status-warning)",
  };

  return colorMap[colorClass] ?? "var(--tes-color-brand-primary)";
}

function iconForMetric(icon: DashboardMetricWithFallback["icon"]) {
  if (icon === "calendar") return CalendarDays;
  if (icon === "heart") return HeartPulse;
  if (icon === "payments") return WalletCards;
  if (icon === "therapist") return UserRound;
  return UsersRound;
}

function metricIconClass(metric: AdminDashboardMetric) {
  if (metric.status !== "available") {
    return "bg-status-warningBg text-status-warning";
  }

  if (metric.tone === "success") return "bg-status-successBg text-status-success";
  if (metric.tone === "warning") return "bg-status-warningBg text-status-warning";
  if (metric.tone === "danger") return "bg-status-dangerBg text-status-danger";
  if (metric.tone === "info") return "bg-status-infoBg text-status-info";

  return "bg-brand-lavenderSoft text-brand-primary";
}

function dotClass(tone: AdminDashboardMetric["tone"]) {
  if (tone === "success") return "bg-status-success";
  if (tone === "warning") return "bg-status-warning";
  if (tone === "danger") return "bg-status-danger";
  if (tone === "info") return "bg-status-info";

  return "bg-brand-primary";
}

function statusPillClass(
  tone: AdminDashboardMetric["tone"] | AdminDashboardAlert["severity"],
) {
  if (tone === "success") return "bg-status-successBg text-status-success";
  if (tone === "warning") return "bg-status-warningBg text-status-warning";
  if (tone === "danger" || tone === "critical") {
    return "bg-status-dangerBg text-status-danger";
  }
  if (tone === "info") return "bg-status-infoBg text-status-info";

  return "bg-brand-lavenderSoft text-brand-primary";
}

function alertIconClass(severity: AdminDashboardAlert["severity"]) {
  if (severity === "critical") return "text-status-danger";
  if (severity === "warning") return "text-status-warning";

  return "text-status-info";
}

function shortMetricLabel(metric: AdminDashboardMetric) {
  const map: Record<string, string> = {
    "active-patients": "Clientes",
    "active-subscriptions": "Assin.",
    "active-therapists": "Prof.",
    "future-sessions": "Sessões",
    "paid-session-payments": "Pagas",
  };

  return map[metric.key] ?? metric.label;
}

function funnelTooltip(step: FunnelStep, firstValue: number) {
  return `${step.label}: ${formatNumber(step.value)}, ${formatPercent(
    step.value,
    firstValue,
  )} da primeira etapa exibida.`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatMetricValue(metric: AdminDashboardMetric | undefined) {
  if (!metric || metric.status !== "available" || metric.value === null) {
    return "—";
  }

  return formatNumber(metric.value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatPercent(value: number, total: number) {
  if (total <= 0) return "0,0%";

  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    style: "percent",
  }).format(value / total);
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "data indisponível";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}
