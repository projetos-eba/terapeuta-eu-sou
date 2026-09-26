import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  HeartPulse,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react";

import { routes } from "@/lib/routes";

import {
  AdminActivityChart,
  AdminFinancialChart,
} from "./admin-dashboard-charts";
import type {
  AdminDashboard,
  AdminDashboardMetric,
  AdminDashboardModule,
} from "../admin-dashboard.types";

type DashboardMetricWithFallback = AdminDashboardMetric & {
  href: Route<string>;
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
          className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4"
        >
          {kpis.map((metric) => (
            <SummaryMetricCard key={metric.key} metric={metric} />
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.88fr)]">
          <EvolutionPanel activity={dashboard.activity} />
          <DistributionPanel items={moduleBreakdown} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
          <OperationalFunnelPanel steps={funnelSteps} />
          <FinancialResultPanel financial={dashboard.financial} />
        </section>
      </div>
    </main>
  );
}

function SummaryMetricCard({
  metric,
}: {
  metric: DashboardMetricWithFallback;
}) {
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
          <Link
            className="group mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-brand-primary outline-none transition hover:text-brand-deep focus-visible:rounded-md focus-visible:ring-4 focus-visible:ring-ring/20"
            href={metric.href}
          >
            Ver detalhes
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </div>
    </article>
  );
}

function FinancialResultPanel({
  financial,
}: {
  financial: AdminDashboard["financial"];
}) {
  return (
    <article className="min-h-[408px] rounded-[20px] border border-brand-lavender/80 bg-white p-6 shadow-[0_18px_42px_rgba(108,61,145,0.08)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold leading-tight text-brand-deep">
            Resultado financeiro
          </h2>
          <p className="mt-2 text-sm font-bold leading-6 text-tesText-muted">
            Evolução das receitas e custos das sessões na plataforma.
          </p>
        </div>
        <span className="w-fit rounded-full bg-white px-4 py-2 text-xs font-extrabold text-brand-primary shadow-[0_8px_24px_rgba(20,16,90,0.07)]">
          {financial.periodLabel}
        </span>
      </div>

      {financial.status === "available" ? (
        <>
          <ChartLegend
            items={[
              { colorClass: "bg-brand-primary", label: "Receita líquida" },
              { colorClass: "bg-brand-lavender", label: "Comissão bruta" },
              { colorClass: "bg-tesText-subtle", label: "Taxas Stripe" },
            ]}
          />
          <div className="mt-4 rounded-[18px] bg-gradient-to-b from-surface-soft/80 to-transparent px-1">
            <AdminFinancialChart financial={financial} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <FinancialMetricTile
              label="Receita líquida"
              metric={financial.metrics.netRevenue}
            />
            <FinancialMetricTile
              label="Comissão bruta"
              metric={financial.metrics.grossCommission}
            />
            <FinancialMetricTile
              label="Taxas Stripe"
              metric={financial.metrics.stripeFees}
            />
          </div>
          {financial.feesStatus === "pending" ? (
            <p className="mt-4 text-xs font-bold leading-5 text-tesText-muted">
              Parte das taxas ainda está em conciliação. Os valores podem ser
              atualizados quando esse processo for concluído.
            </p>
          ) : null}
        </>
      ) : (
        <UnavailableState>
          Ainda não há pagamentos confirmados no período para montar este
          resultado. Consulte Financeiro para acompanhar os pagamentos.
        </UnavailableState>
      )}

      <Link
        className="group mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-brand-primary outline-none transition hover:text-brand-deep focus-visible:rounded-md focus-visible:ring-4 focus-visible:ring-ring/20"
        href={routes.admin.payments}
      >
        Ver detalhes
        <ArrowRight
          aria-hidden="true"
          className="size-4 transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    </article>
  );
}

function FinancialMetricTile({
  label,
  metric,
}: {
  label: string;
  metric: AdminDashboard["financial"]["metrics"]["netRevenue"];
}) {
  return (
    <div className="rounded-[16px] border border-brand-lavender/80 bg-surface-soft px-4 py-4">
      <p className="text-sm font-extrabold leading-tight text-tesText-secondary">
        {label}
      </p>
      <p className="mt-3 text-2xl font-extrabold leading-none text-brand-deep">
        {formatCurrency(metric.currentCents)}
      </p>
      <MetricChange metric={metric} />
    </div>
  );
}

function EvolutionPanel({
  activity,
}: {
  activity: AdminDashboard["activity"];
}) {
  return (
    <article className="min-h-[437px] rounded-[20px] border border-brand-lavender/80 bg-white p-6 shadow-[0_18px_42px_rgba(108,61,145,0.08)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold leading-tight text-brand-deep">
            Evolução da plataforma
          </h2>
          <ChartLegend
            items={[
              { colorClass: "bg-brand-cyan", label: "Pacientes cadastrados" },
              {
                colorClass: "bg-status-success",
                label: "Profissionais cadastrados",
              },
              { colorClass: "bg-brand-primary", label: "Sessões criadas" },
            ]}
          />
        </div>
        <span className="w-fit rounded-full bg-white px-4 py-2 text-xs font-extrabold text-brand-primary shadow-[0_8px_24px_rgba(20,16,90,0.07)]">
          {activity.periodLabel}
        </span>
      </div>

      {activity.status === "available" ? (
        <>
          <div
            className="relative z-0 mt-5 rounded-[18px]"
            style={{
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--tes-color-surface-soft) 72%, transparent), transparent)",
            }}
          >
            <AdminActivityChart activity={activity} />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <ActivityMetricTile
              label="Pacientes cadastrados"
              metric={activity.metrics.patients}
            />
            <ActivityMetricTile
              label="Profissionais cadastrados"
              metric={activity.metrics.professionals}
            />
            <ActivityMetricTile
              label="Sessões criadas"
              metric={activity.metrics.sessions}
            />
          </div>
        </>
      ) : (
        <UnavailableState>
          Ainda não há movimentação suficiente no período para montar esta
          visão.
        </UnavailableState>
      )}
    </article>
  );
}

function ActivityMetricTile({
  label,
  metric,
}: {
  label: string;
  metric: AdminDashboard["activity"]["metrics"]["patients"];
}) {
  return (
    <div className="rounded-[14px] border border-brand-lavender/80 bg-white px-4 py-3 shadow-[0_12px_22px_rgba(108,61,145,0.04)]">
      <p className="text-xs font-extrabold text-tesText-secondary">
        {label}
      </p>
      <p className="mt-2 text-lg font-extrabold leading-none text-brand-deep">
        {formatNumber(metric.current)}
      </p>
      <MetricChange metric={metric} />
    </div>
  );
}

function ChartLegend({
  items,
}: {
  items: Array<{ colorClass: string; label: string }>;
}) {
  return (
    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
      {items.map((item) => (
        <span
          className="inline-flex items-center gap-2 text-xs font-extrabold text-tesText-secondary"
          key={item.label}
        >
          <span className={`size-2.5 rounded-full ${item.colorClass}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function MetricChange({
  metric,
}: {
  metric:
    | AdminDashboard["activity"]["metrics"]["patients"]
    | AdminDashboard["financial"]["metrics"]["netRevenue"];
}) {
  const current = "current" in metric ? metric.current : metric.currentCents;
  const previous = "previous" in metric ? metric.previous : metric.previousCents;

  if (previous <= 0) {
    return (
      <p className="mt-3 text-xs font-bold text-tesText-muted">
        {current > 0 ? "Novo no período" : "Sem comparação"}
      </p>
    );
  }

  const percent = ((current - previous) / Math.abs(previous)) * 100;
  const isPositive = percent >= 0;

  return (
    <p
      className={`mt-3 text-xs font-extrabold ${
        isPositive ? "text-status-success" : "text-status-danger"
      }`}
    >
      {isPositive ? "+" : ""}
      {new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: 0,
      }).format(percent)}
      %
      <span className="ml-1 font-bold text-tesText-muted">vs. período anterior</span>
    </p>
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
                    <span className="mt-1 block rounded-full bg-brand-lavenderSoft px-2 py-1 text-xs font-extrabold text-brand-primary">
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
              accentColor={segment.color}
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
  accentColor = "var(--tes-color-brand-lavender)",
  lines,
  viewBoxWidth,
  x,
  y,
}: {
  accentColor?: string;
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
      <rect
        fill={accentColor}
        height={Math.max(18, height - 20)}
        rx="2"
        width="3"
        x={left + 10}
        y={top + 10}
      />
      <text
        fill="white"
        fontSize="12"
        fontWeight="600"
        x={left + 22}
        y={top + 21}
      >
        {lines.map((line, index) => (
          <tspan
            dy={index === 0 ? 0 : 16}
            fontSize={index === 0 ? "13" : "12"}
            fontWeight={index === 0 ? "800" : "600"}
            key={`${line}-${index}`}
            x={left + 22}
          >
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function StaticCardFooter({ children }: { children: ReactNode }) {
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
  tone: AdminDashboardMetric["tone"];
}) {
  return (
    <span
      className={`inline-flex min-h-7 items-center justify-center rounded-full px-3 text-sm font-extrabold ${statusPillClass(
        tone,
      )} ${className}`}
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
    withIcon(
      findMetric(metrics, "active-therapists"),
      "therapist",
      routes.admin.professionals,
    ),
    withIcon(findMetric(metrics, "active-patients"), "users", routes.admin.patients),
    withIcon(findMetric(metrics, "future-sessions"), "calendar", routes.admin.sessions),
    withIcon(
      findMetric(metrics, "paid-session-payments"),
      "payments",
      routes.admin.payments,
    ),
  ].filter(Boolean) as DashboardMetricWithFallback[];
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

  return undefined;
}

function findMetric(metrics: AdminDashboardMetric[], key: string) {
  return metrics.find((metric) => metric.key === key);
}

function withIcon(
  metric: AdminDashboardMetric | undefined,
  icon: DashboardMetricWithFallback["icon"],
  href: Route<string>,
) {
  return metric ? { ...metric, href, icon } : null;
}

function isAvailableMetric(
  metric: AdminDashboardMetric | undefined,
): metric is AvailableMetric {
  return Boolean(
    metric && metric.status === "available" && metric.value !== null,
  );
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

  if (metric.tone === "success")
    return "bg-status-successBg text-status-success";
  if (metric.tone === "warning")
    return "bg-status-warningBg text-status-warning";
  if (metric.tone === "danger") return "bg-status-dangerBg text-status-danger";
  if (metric.tone === "info") return "bg-status-infoBg text-status-info";

  return "bg-brand-lavenderSoft text-brand-primary";
}

function statusPillClass(
  tone: AdminDashboardMetric["tone"],
) {
  if (tone === "success") return "bg-status-successBg text-status-success";
  if (tone === "warning") return "bg-status-warningBg text-status-warning";
  if (tone === "danger") {
    return "bg-status-dangerBg text-status-danger";
  }
  if (tone === "info") return "bg-status-infoBg text-status-info";

  return "bg-brand-lavenderSoft text-brand-primary";
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

function formatCurrency(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(valueInCents / 100);
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
