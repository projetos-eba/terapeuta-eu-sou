import { CheckCircle2, Info, OctagonX } from "lucide-react";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";

export function CancellationPolicyCard({
  policy,
  paymentFlowVersion,
}: {
  policy: PatientSessionDetailPageData["cancellationPolicy"];
  paymentFlowVersion?: string;
}) {
  return (
    <section className="rounded-card border border-border bg-white p-5 shadow-card sm:p-7">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary sm:size-11">
          <Info aria-hidden="true" size={19} />
        </span>
        <h2 className="font-display text-[2rem] font-light italic leading-[0.96] text-brand-deep sm:text-[2.3rem]">
          Política de cancelamento
        </h2>
      </div>

      <div className="mt-6 rounded-[24px] bg-surface-soft p-5 sm:p-6">
        {paymentFlowVersion === "v10" ? (
          <div className="space-y-5">
            <PolicyLine
              icon={CheckCircle2}
              text="Se o cartão ainda não foi cobrado, você pode cancelar sem precisar solicitar reembolso."
              title="Mais de 24 horas de antecedência"
              tone="success"
            />
            <PolicyLine
              icon={Info}
              text="Para solicitar uma alteração depois da cobrança, fale com nossa equipe de suporte."
              title="Após a cobrança"
              tone="warning"
            />
            <PolicyLine
              icon={OctagonX}
              text="A ausência do cliente não gera reembolso automático. Casos excepcionais podem ser analisados."
              title="Não comparecimento"
              tone="danger"
            />
          </div>
        ) : (
          <>
        <div className="space-y-5">
          <PolicyLine
            icon={CheckCircle2}
            text="Reembolso integral ou reagendamento, quando aplicável."
            title={`Até ${policy.freeUntilHours} horas de antecedência`}
            tone="success"
          />
          <PolicyLine
            icon={Info}
            text="Sem obrigação de reembolso. Exceções podem ser analisadas pelo TES."
            title={`Menos de ${policy.freeUntilHours} horas`}
            tone="warning"
          />
          <PolicyLine
            icon={OctagonX}
            text="Sem obrigação de reembolso. Casos excepcionais podem ser analisados."
            title="Não comparecimento"
            tone="danger"
          />
        </div>

        <p className="mt-5 border-t border-border pt-4 text-[11px] font-semibold leading-5 text-tesText-secondary sm:text-xs">
          Após aprovação, o processamento do reembolso começa em até 7 dias
          úteis. O prazo de crédito depende do meio de pagamento.
        </p>
          </>
        )}
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
