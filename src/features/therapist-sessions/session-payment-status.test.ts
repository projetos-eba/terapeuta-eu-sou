import { describe, expect, it } from "vitest";

import { SessionFinancialStatus } from "@/domain/tes";

import { getTherapistSessionPaymentStatus } from "./session-payment-status";

describe("getTherapistSessionPaymentStatus", () => {
  it("presents a future reserved session as a scheduled payment", () => {
    expect(
      getTherapistSessionPaymentStatus({
        financialStatus: SessionFinancialStatus.Pending,
        sessionState: "reserved",
      }),
    ).toEqual({
      description: "A cobrança será realizada 24 horas antes da sessão.",
      label: "Agendado",
      tone: "brand",
    });
  });

  it("keeps an ordinary pending payment distinct from the scheduled window", () => {
    expect(
      getTherapistSessionPaymentStatus({
        financialStatus: SessionFinancialStatus.Pending,
        sessionState: "payment_pending",
      }),
    ).toEqual({
      description: "A confirmação do pagamento ainda está em andamento.",
      label: "Aguardando confirmação",
      tone: "warning",
    });
  });

  it("presents an approved payment as confirmed", () => {
    expect(
      getTherapistSessionPaymentStatus({
        financialStatus: SessionFinancialStatus.Paid,
        sessionState: "confirmed",
      }),
    ).toEqual({
      description: "O pagamento desta sessão foi confirmado.",
      label: "Confirmado",
      tone: "success",
    });
  });
});
