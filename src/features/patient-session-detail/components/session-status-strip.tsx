import { CheckCircle2, Clock3, CreditCard, ShieldCheck } from "lucide-react";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";

export function SessionStatusStrip({
  data,
}: {
  data: PatientSessionDetailPageData;
}) {
  const paymentConfirmed = data.encounterState.payment.kind === "confirmed";
  const roomAvailable = ["entry_available", "therapist_present"].includes(
    data.encounterState.waitingRoom.kind,
  );
  const encounterConfirmed =
    data.booking.status === "confirmed" || data.booking.status === "live";

  return (
    <section
      aria-label="Resumo do estado do encontro"
      className="grid grid-cols-3 overflow-hidden rounded-card border border-border bg-white shadow-card"
    >
      <StatusItem
        icon={CreditCard}
        supporting={data.encounterState.payment.message}
        tone={paymentConfirmed ? "success" : "warning"}
        title={data.encounterState.payment.title}
      />
      <StatusItem
        icon={roomAvailable ? CheckCircle2 : Clock3}
        supporting={data.encounterState.waitingRoom.message}
        tone={roomAvailable ? "success" : "neutral"}
        title={data.encounterState.waitingRoom.title}
      />
      <StatusItem
        icon={ShieldCheck}
        supporting={
          encounterConfirmed
            ? "Seu horário está reservado para você."
            : data.booking.statusLabel
        }
        tone={encounterConfirmed ? "success" : "neutral"}
        title={
          encounterConfirmed ? "Encontro confirmado" : data.booking.statusLabel
        }
      />
    </section>
  );
}

function StatusItem({
  icon: Icon,
  supporting,
  title,
  tone,
}: {
  icon: typeof CreditCard;
  supporting: string;
  title: string;
  tone: "neutral" | "success" | "warning";
}) {
  const toneClasses = {
    neutral: "bg-brand-lavenderSoft text-brand-primary",
    success: "bg-status-successBg text-status-success",
    warning: "bg-status-warningBg text-status-warning",
  }[tone];

  return (
    <div className="flex min-w-0 flex-col gap-2 border-l border-border p-3 first:border-l-0 sm:flex-row sm:gap-3 sm:p-5">
      <span
        className={`grid size-9 shrink-0 place-items-center self-start rounded-full ${toneClasses} sm:size-10`}
      >
        <Icon aria-hidden="true" size={19} />
      </span>
      <div className="min-w-0">
        <h2 className="text-[14px] font-extrabold leading-5 text-brand-deep sm:text-base">
          {title}
        </h2>
        <p className="mt-1 text-[11px] font-semibold leading-4 text-tesText-secondary sm:text-sm sm:leading-5">
          {supporting}
        </p>
      </div>
    </div>
  );
}
