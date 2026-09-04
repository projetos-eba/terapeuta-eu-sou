"use client";

import { useEffect, useState } from "react";

import { TESButton } from "@/components/tes";
import { routes } from "@/lib/routes";

type RecoveryState =
  | "checking"
  | "retryable"
  | "payment_in_progress"
  | "unknown";

export function ExpiredCheckoutRecovery({
  bookingId,
  checkoutSessionId,
}: {
  bookingId: string;
  checkoutSessionId: string;
}) {
  const [state, setState] = useState<RecoveryState>("checking");
  const [checkNumber, setCheckNumber] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("checking");

    async function releaseExpiredCheckout() {
      try {
        const response = await fetch("/api/public/reservation/abandon", {
          body: JSON.stringify({
            bookingId,
            checkoutSessionId,
            reason: "reservation_expired",
            requestId: crypto.randomUUID(),
          }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          method: "POST",
        });
        const result = (await response.json()) as {
          ok?: boolean;
          data?: { released?: boolean };
        };
        if (cancelled) return;
        if (!response.ok || result.ok !== true) {
          setState("unknown");
          return;
        }
        // A refusal may mean authorization/capture won the race, or that
        // another tab replaced this Checkout. Never infer a second payment is safe.
        setState(
          result.data?.released === true ? "retryable" : "payment_in_progress",
        );
      } catch {
        if (!cancelled) setState("unknown");
      }
    }

    void releaseExpiredCheckout();
    return () => {
      cancelled = true;
    };
  }, [bookingId, checkoutSessionId, checkNumber]);

  const retryParams = new URLSearchParams({
    booking: bookingId,
    etapa: "pagamento",
  });
  const statusParams = new URLSearchParams({
    booking: bookingId,
    session_id: checkoutSessionId,
  });

  return (
    <div className="space-y-4 rounded-[18px] border border-brand-lavender bg-brand-lavenderSoft p-5">
      <p className="text-sm font-extrabold text-brand-deep">
        O prazo de exclusividade de 5 minutos terminou.
      </p>
      <p
        role="status"
        className="text-sm font-semibold leading-6 text-tesText-secondary"
      >
        {state === "checking"
          ? "Estamos conferindo o pagamento para que você possa continuar com segurança."
          : state === "retryable"
            ? "Você ainda pode pagar por este encontro, sem escolher o horário novamente. O horário não fica mais reservado enquanto você preenche o formulário; a disponibilidade será conferida antes da cobrança."
            : state === "payment_in_progress"
              ? "O pagamento pode já estar em confirmação ou ter sido atualizado em outra aba. Confira a situação antes de tentar pagar novamente."
              : "Não conseguimos verificar a situação do pagamento agora. Verifique novamente antes de continuar."}
      </p>
      {state === "retryable" ? (
        <TESButton href={`${routes.public.reservation}?${retryParams}`}>
          Continuar pagamento
        </TESButton>
      ) : null}
      {state === "unknown" ? (
        <TESButton
          onClick={() => setCheckNumber((value) => value + 1)}
          type="button"
        >
          Verificar novamente
        </TESButton>
      ) : null}
      {state === "payment_in_progress" ? (
        <TESButton href={`${routes.public.reservationSuccess}?${statusParams}`}>
          Acompanhar pagamento
        </TESButton>
      ) : null}
    </div>
  );
}
