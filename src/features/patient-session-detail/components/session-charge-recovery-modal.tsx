"use client";

import { useState } from "react";
import { AlertCircle, CreditCard } from "lucide-react";

import { TESButton } from "@/components/tes/tes-button";
import { TESDialog } from "@/components/tes/tes-dialog";

import { SessionChargeRecoveryCard } from "./session-charge-recovery-card";

export function SessionChargeRecoveryModal({
  bookingId,
  stripePublishableKey,
}: {
  bookingId: string;
  stripePublishableKey: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="grid gap-4 rounded-card border border-status-warning bg-status-warningBg p-5 shadow-card sm:p-7">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-status-warning">
            <AlertCircle aria-hidden="true" size={21} />
          </span>
          <div className="grid gap-1">
            <h2 className="text-lg font-extrabold text-brand-deep">
              Confirme o pagamento para manter o encontro
            </h2>
            <p className="text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
              Seu banco precisa de uma confirmação ou de outro cartão. Conclua
              esta etapa antes do horário agendado.
            </p>
          </div>
        </div>
        <TESButton
          className="w-full sm:w-fit"
          onClick={() => setOpen(true)}
          type="button"
        >
          <CreditCard aria-hidden="true" size={19} />
          Concluir pagamento
        </TESButton>
      </section>

      {open ? (
        <TESDialog
          className="max-w-[720px]"
          hideHeader
          onClose={() => setOpen(false)}
          title="Concluir pagamento"
        >
          <SessionChargeRecoveryCard
            bookingId={bookingId}
            stripePublishableKey={stripePublishableKey}
          />
        </TESDialog>
      ) : null}
    </>
  );
}
