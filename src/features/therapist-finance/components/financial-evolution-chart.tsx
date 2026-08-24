"use client";

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
import { TrendingUp } from "lucide-react";

import { formatCurrency } from "./financial-formatters";

export type FinancialEvolutionValue = {
  contracted?: number | null;
  current?: number | null;
  gross?: number | null;
  previous?: number | null;
  projected?: number | null;
};

export type FinancialEvolutionChartPoint = FinancialEvolutionValue & {
  label: string;
};

export type FinancialEvolutionSeries = {
  color: string;
  dataKey: keyof FinancialEvolutionValue;
  label: string;
  type: "bar" | "line";
};

export type FinancialEvolutionHighlight = {
  color: string;
  label: string;
  value: string;
};

export function FinancialEvolutionChart({
  emptyMessage = "A evolução aparece assim que houver recebimentos confirmados no período.",
  footer,
  highlights = [],
  points,
  series,
}: {
  emptyMessage?: string;
  footer?: string;
  highlights?: FinancialEvolutionHighlight[];
  points: FinancialEvolutionChartPoint[];
  series: FinancialEvolutionSeries[];
}) {
  const hasData = points.some((point) =>
    series.some((item) => Number(point[item.dataKey] ?? 0) > 0),
  );

  return (
    <section
      aria-label="Evolução financeira"
      className="grid gap-5 rounded-panel border border-brand-lavender bg-white p-5 shadow-card sm:p-6"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(190px,0.9fr)_minmax(0,1.7fr)_auto] xl:items-start">
        <div>
          <h2 className="font-display text-[28px] font-light italic leading-tight text-brand-deep sm:text-[32px]">
            Evolução financeira
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            Compare a leitura dos períodos com mais clareza.
          </p>
        </div>
        {highlights.length ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {highlights.map((item) => (
              <div className="grid grid-cols-[10px_minmax(0,1fr)] gap-x-2" key={item.label}>
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span>
                  <span className="block text-[11px] font-extrabold text-tesText-secondary">
                    {item.label}
                  </span>
                  <strong className="mt-0.5 block text-sm font-extrabold tabular-nums text-brand-deep">
                    {item.value}
                  </strong>
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <span className="inline-flex min-h-10 w-fit items-center rounded-lg border border-brand-lavender bg-white px-3 py-2 text-sm font-extrabold text-brand-primary">
          {points.length ? `${points.length} períodos` : "Aguardando dados"}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-extrabold text-tesText-secondary">
        {series.map((item) => (
          <span className="inline-flex items-center gap-2" key={item.dataKey}>
            <span
              aria-hidden="true"
              className={`inline-block h-3 w-3 rounded-sm ${item.type === "line" ? "border-2 bg-transparent" : ""}`}
              style={{
                backgroundColor: item.type === "bar" ? item.color : undefined,
                borderColor: item.type === "line" ? item.color : undefined,
              }}
            />
            {item.label}
          </span>
        ))}
      </div>

      {hasData ? (
        <div className="overflow-x-auto rounded-[14px] border border-brand-lavender/60 bg-surface-soft/55 px-2 py-4 sm:px-4">
          <div
            aria-label="Gráfico com a evolução dos valores financeiros"
            className="h-[270px] min-w-[560px]"
            role="img"
            tabIndex={0}
          >
            <ResponsiveContainer height="100%" width="100%">
              <ComposedChart
                data={points}
                margin={{ bottom: 4, left: 8, right: 12, top: 10 }}
              >
                <CartesianGrid
                  stroke="var(--tes-color-brand-lavender)"
                  strokeDasharray="2 5"
                  vertical={false}
                />
                <XAxis
                  axisLine={false}
                  dataKey="label"
                  tick={{
                    fill: "var(--tes-color-text-secondary)",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  tick={{
                    fill: "var(--tes-color-text-muted)",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                  tickFormatter={(value: number) =>
                    formatCompactCurrency(value)
                  }
                  tickLine={false}
                  width={62}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--tes-color-surface-elevated)",
                    border: "1px solid var(--tes-color-brand-lavender)",
                    borderRadius: "12px",
                    boxShadow: "var(--tes-shadow-float)",
                    color: "var(--tes-color-brand-deep)",
                    fontSize: "14px",
                    fontWeight: 700,
                  }}
                  formatter={(value, name) => [
                    formatCurrency(Number(value ?? 0)),
                    String(name),
                  ]}
                  labelFormatter={(label) => `Período: ${label}`}
                />
                {series.map((item) =>
                  item.type === "bar" ? (
                    <Bar
                      dataKey={item.dataKey}
                      fill={item.color}
                      isAnimationActive={false}
                      key={item.dataKey}
                      maxBarSize={34}
                      name={item.label}
                      radius={[8, 8, 0, 0]}
                    />
                  ) : (
                    <Line
                      activeDot={{ r: 5, strokeWidth: 2 }}
                      dataKey={item.dataKey}
                      dot={{ fill: item.color, r: 4, strokeWidth: 2 }}
                      isAnimationActive={false}
                      key={item.dataKey}
                      name={item.label}
                      stroke={item.color}
                      strokeDasharray="6 5"
                      strokeWidth={3}
                      type="monotone"
                    />
                  ),
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <EmptyEvolutionChart message={emptyMessage} />
      )}

      <ul className="sr-only">
        {points.map((point) => (
          <li key={point.label}>
            {point.label}: {formatPointValues(point, series)}
          </li>
        ))}
      </ul>

      <p className="flex items-start gap-3 rounded-lg bg-status-successBg/70 px-4 py-3 text-sm font-semibold leading-6 text-tesText-secondary">
        <TrendingUp
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-status-success"
          size={18}
        />
        <span>
          {footer ??
            (hasData
              ? "Os valores são mostrados em reais e respeitam o período selecionado."
              : "Este espaço permanece pronto para receber sua evolução quando houver uma base financeira no período.")}
        </span>
      </p>
    </section>
  );
}

function EmptyEvolutionChart({ message }: { message: string }) {
  return (
    <div className="relative h-[270px] overflow-hidden rounded-[14px] bg-surface-soft px-5 py-4">
      <div
        aria-hidden="true"
        className="absolute inset-x-6 inset-y-6 rounded-lg opacity-70 [background-image:linear-gradient(to_bottom,var(--tes-color-brand-lavender)_1px,transparent_1px)] [background-size:100%_25%]"
      />
      <div className="relative grid h-full place-items-center text-center">
        <div className="max-w-sm rounded-xl border border-dashed border-brand-lavender bg-white/90 px-5 py-4 shadow-card">
          <p className="text-sm font-extrabold text-brand-deep">
            Ainda estamos reunindo sua evolução
          </p>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

function formatCompactCurrency(value: number) {
  const reais = value / 100;
  if (Math.abs(reais) >= 1000) {
    return `R$ ${(reais / 1000).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })} mil`;
  }
  return formatCurrency(value).replace(",00", "");
}

function formatPointValues(
  point: FinancialEvolutionChartPoint,
  series: FinancialEvolutionSeries[],
) {
  return series
    .map(
      (item) =>
        `${item.label} ${formatCurrency(Number(point[item.dataKey] ?? 0))}`,
    )
    .join(", ");
}
