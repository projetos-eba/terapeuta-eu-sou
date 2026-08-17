import { Check, CheckCheck, MessageCircle, Star } from "lucide-react";

import type { TherapistReviewsMetric } from "../therapist-reviews.types";

const metricIcons = {
  average: Star,
  positive: Check,
  responded: CheckCheck,
  total: MessageCircle,
};

const metricIconStyles = {
  average: "bg-status-warningBg text-status-warning",
  positive: "bg-status-successBg text-status-success",
  responded: "bg-brand-lavenderSoft text-brand-primary",
  total: "bg-brand-cyanSoft text-status-info",
};

export function TherapistReviewMetricCard({
  metric,
}: {
  metric: TherapistReviewsMetric;
}) {
  const Icon = metricIcons[metric.key];
  const trendLabel = formatTrend(metric.trend);
  const trendClassName =
    metric.trend.direction === "up"
      ? "bg-status-successBg text-status-success"
      : "bg-brand-lavenderSoft text-brand-primary";

  return (
    <article className="flex min-h-[204px] flex-col rounded-card border border-brand-lavender/70 bg-white p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span
          className={`grid size-12 shrink-0 place-items-center rounded-full ${metricIconStyles[metric.key]}`}
        >
          <Icon aria-hidden="true" size={22} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold leading-5 text-brand-deep">
            {metric.label}
          </h2>
          <p className="mt-3 text-[42px] font-extrabold leading-none tracking-[-0.04em] text-brand-deep">
            {metric.value}
          </p>
        </div>
      </div>

      <p className="mt-5 text-sm font-semibold leading-6 text-tesText-secondary">
        {metric.helper}
      </p>

      <div className="mt-auto border-t border-brand-lavender pt-3">
        {trendLabel ? (
          <p
            className={`inline-flex min-h-8 items-center rounded-full px-3 text-sm font-extrabold ${trendClassName}`}
          >
            {trendLabel}
            <span className="ml-1 font-semibold">vs. 30 dias anteriores</span>
          </p>
        ) : (
          <p className="text-sm font-semibold leading-6 text-tesText-muted">
            Ainda sem comparação segura
          </p>
        )}
      </div>
    </article>
  );
}

function formatTrend(metric: TherapistReviewsMetric["trend"]) {
  if (metric.value === null || metric.direction === "flat") return null;
  const prefix = metric.direction === "up" ? "↑" : "↓";
  return `${prefix} ${metric.value.toLocaleString("pt-BR")}`;
}
