import { Check, CheckCheck, MessageCircle, Star } from "lucide-react";

import type { TherapistReviewsMetric } from "../therapist-reviews.types";

const metricIcons = {
  average: Star,
  positive: Check,
  responded: CheckCheck,
  total: MessageCircle,
};

export function TherapistReviewMetricCard({
  metric,
}: {
  metric: TherapistReviewsMetric;
}) {
  const Icon = metricIcons[metric.key];
  const trendLabel = formatTrend(metric.trend);

  return (
    <article className="min-h-[184px] rounded-card border border-brand-lavender/70 bg-white p-5 shadow-card">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Icon aria-hidden="true" size={22} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold leading-5 text-brand-deep">
            {metric.label}
          </h2>
          <p className="mt-2 text-3xl font-extrabold leading-none text-brand-deep">
            {metric.value}
          </p>
        </div>
      </div>

      <p className="mt-5 min-h-10 text-sm font-semibold leading-5 text-tesText-secondary">
        {metric.helper}
      </p>

      <div className="mt-4 border-t border-brand-lavender pt-3">
        {trendLabel ? (
          <p className="inline-flex min-h-8 items-center rounded-full bg-status-successBg px-3 text-sm font-extrabold text-status-success">
            {trendLabel}
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
