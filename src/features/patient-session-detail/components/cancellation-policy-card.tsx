import { CheckCircle2, Info, OctagonX } from "lucide-react";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";

export function CancellationPolicyCard({
  policy,
}: {
  policy: PatientSessionDetailPageData["cancellationPolicy"];
}) {
  return (
    <section className="grid gap-6 border-t border-border pt-8">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-primary sm:text-xs">
          Regras importantes
        </p>
        <h2 className="mt-3 font-display text-[2rem] font-light italic leading-none text-brand-deep sm:text-[2.3rem]">
          Política de cancelamento
        </h2>
      </div>

      <div className="rounded-[28px] border border-border bg-white/80 p-5 sm:p-6">
        <div className="space-y-5">
          <PolicyLine
            icon={CheckCircle2}
            text="Sem custo"
            title={`Até ${policy.freeUntilHours} horas de antecedência`}
            tone="success"
          />
          <PolicyLine
            icon={Info}
            text={`Sujeito à cobrança de ${policy.lateCancelFeePercent}% do valor`}
            title={`Menos de ${policy.freeUntilHours} horas`}
            tone="warning"
          />
          <PolicyLine
            icon={OctagonX}
            text={`Cobrança de ${policy.noShowFeePercent}% do valor do encontro`}
            title="Não comparecimento"
            tone="danger"
          />
        </div>

        <p className="mt-5 border-t border-border pt-4 text-[11px] font-semibold leading-5 text-tesText-secondary sm:text-xs">
          O cálculo final sempre é confirmado pelo backend no momento da
          solicitação.
        </p>
      </div>
    </section>
  );
}

function PolicyLine({
  icon: Icon,
  text,
  title,
  tone,
}: {
  icon: typeof CheckCircle2;
  text: string;
  title: string;
  tone: "danger" | "success" | "warning";
}) {
  const color = {
    danger: "text-status-danger",
    success: "text-status-success",
    warning: "text-status-warning",
  }[tone];

  return (
    <div className="flex gap-3">
      <Icon
        aria-hidden="true"
        className={`mt-0.5 shrink-0 ${color}`}
        size={22}
      />
      <div>
        <p className="text-sm font-extrabold leading-6 text-brand-deep sm:text-base">
          {title}
        </p>
        <p className="mt-1 text-[11px] font-semibold leading-5 text-tesText-secondary sm:text-xs">
          {text}
        </p>
      </div>
    </div>
  );
}
