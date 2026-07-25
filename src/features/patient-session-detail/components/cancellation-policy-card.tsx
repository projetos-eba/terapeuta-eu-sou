import { CheckCircle2, Info, OctagonX } from "lucide-react";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";

export function CancellationPolicyCard({
  policy,
}: {
  policy: PatientSessionDetailPageData["cancellationPolicy"];
}) {
  return (
    <section className="rounded-card border border-brand-lavender bg-white p-6 shadow-card">
      <h2 className="font-display text-2xl font-light italic text-brand-deep">
        Política de cancelamento
      </h2>
      <div className="mt-6 space-y-5">
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
          text={`Cobrança de ${policy.noShowFeePercent}% do valor da sessão`}
          title="Não comparecimento"
          tone="danger"
        />
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
      <Icon aria-hidden="true" className={`mt-0.5 shrink-0 ${color}`} size={22} />
      <div>
        <p className="text-sm font-extrabold text-brand-deep">{title}</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-tesText-secondary">
          {text}
        </p>
      </div>
    </div>
  );
}
