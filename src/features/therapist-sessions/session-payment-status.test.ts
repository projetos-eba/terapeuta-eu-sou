import { describe, expect, it } from "vitest";

import { BookingStatus, SessionFinancialStatus } from "@/domain/tes";

import { getTherapistSessionPaymentStatus } from "./session-payment-status";

describe("getTherapistSessionPaymentStatus", () => {
  it.each([BookingStatus.NoShowTherapist, BookingStatus.NoShowBoth])(
    "keeps payment status independent of %s attendance review",
    (bookingStatus) => {
      expect(
        getTherapistSessionPaymentStatus({
          bookingStatus,
          financialStatus: SessionFinancialStatus.Paid,
          sessionState: "requires_attention",
        }),
      ).toMatchObject({ label: "Confirmado", tone: "success" });
    },
  );
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

  it("keeps a future scheduled payment scheduled while a reschedule is awaiting a response", () => {
    expect(
      getTherapistSessionPaymentStatus({
        financialStatus: SessionFinancialStatus.Pending,
        now: new Date("2026-09-16T12:00:00.000Z"),
        sessionState: "reschedule_requested",
        startsAt: "2026-09-20T12:00:00.000Z",
      }),
    ).toEqual({
      description: "A cobrança será realizada 24 horas antes da sessão.",
      label: "Agendado",
      tone: "brand",
    });
  });

  it("does not present an overdue reschedule request as a scheduled payment", () => {
    expect(
      getTherapistSessionPaymentStatus({
        financialStatus: SessionFinancialStatus.Pending,
        now: new Date("2026-09-16T12:00:00.000Z"),
        sessionState: "reschedule_requested",
        startsAt: "2026-09-17T11:59:59.000Z",
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
