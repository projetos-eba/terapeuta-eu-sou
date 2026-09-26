import { describe, expect, it } from "vitest";

import {
  formatTransferStatus,
  mapAdminFinanceDetail,
  mapAdminFinanceRows,
} from "./admin-finance.mappers";

describe("admin finance mappers", () => {
  it("maps payments without leaking Stripe object identifiers", () => {
    const [row] = mapAdminFinanceRows({
      module: "payments",
      rows: [
        {
          booking_id: "booking-123456789",
          currency: "brl",
          financial_status: "paid",
          gross_amount_cents: 17000,
          id: "payment-1",
          metadata: { raw: "hidden-financial-metadata" },
          patient_name: "Mariana Souza",
          payment_method_type: "pix",
          platform_gross_commission_cents: 3400,
          refund_pending: false,
          service_status: "completed",
          stripe_fee_amount_cents: 510,
          stripe_checkout_session_id: "cs_test_secret",
          stripe_payment_intent_id: "pi_secret",
          therapist_amount_cents: 13600,
          therapist_name: "Ana Oliveira",
          transfer_status: "pending",
          updated_at: "2026-08-08T12:00:00.000Z",
        },
      ],
    });

    expect(row.title).toBe("Pagamento de sessão");
    expect(row.statusLabel).toBe("paid");
    expect(row.detailHref).toBe("/admin/pagamentos/payment-1");
    expect(JSON.stringify(row)).not.toContain("cs_test_secret");
    expect(JSON.stringify(row)).not.toContain("pi_secret");
    expect(JSON.stringify(row)).not.toContain("hidden-financial-metadata");
    expect(row.fields.map((field) => field.label)).toEqual([
      "Cliente",
      "Profissional",
      "Forma de pagamento",
      "Atendimento",
      "Repasse",
      "Valor bruto",
      "Repasse terapeuta",
      "Comissão TES",
      "Taxas Stripe",
      "Reembolso pendente",
      "Data e hora",
    ]);
    expect(row.fields).toContainEqual({ label: "Forma de pagamento", value: "Pix" });
  });

  it("presents refunded sessions as closed without a stale transferred state", () => {
    const [row] = mapAdminFinanceRows({
      module: "payments",
      rows: [
        {
          financial_status: "refunded",
          id: "payment-refunded",
          service_status: "scheduled",
          transfer_status: "transferred",
        },
      ],
    });

    expect(row.fields).toContainEqual({
      label: "Atendimento",
      value: "Encerrado",
    });
    expect(row.fields).toContainEqual({
      label: "Repasse",
      value: "Valor a compensar",
    });
  });

  it("uses the booking outcome for attendance without changing the paid payout", () => {
    const [row] = mapAdminFinanceRows({
      module: "payments",
      rows: [
        {
          booking_status: "no_show_both",
          financial_status: "paid",
          id: "payment-no-show",
          payout_display_status: "paid",
          service_status: "scheduled",
          transfer_status: "transferred",
        },
      ],
    });

    expect(row.fields).toContainEqual({
      label: "Atendimento",
      value: "Não realizado",
    });
    expect(row.fields).toContainEqual({ label: "Repasse", value: "Pago" });
  });

  it("keeps scheduled as the fallback for a confirmed future booking", () => {
    const [row] = mapAdminFinanceRows({
      module: "payments",
      rows: [
        {
          booking_status: "confirmed",
          financial_status: "paid",
          id: "payment-confirmed",
          service_status: "scheduled",
        },
      ],
    });

    expect(row.fields).toContainEqual({
      label: "Atendimento",
      value: "Agendado",
    });
  });

  it("presents a payment-cancelled booking as cancelled", () => {
    const [row] = mapAdminFinanceRows({
      module: "payments",
      rows: [
        {
          booking_status: "cancelled_by_payment",
          financial_status: "canceled",
          id: "payment-canceled",
          service_status: "scheduled",
          transfer_status: "not_eligible",
        },
      ],
    });

    expect(row.fields).toContainEqual({
      label: "Atendimento",
      value: "Cancelado",
    });
    expect(row.fields).toContainEqual({
      label: "Repasse",
      value: "Ainda não elegível",
    });
  });

  it("keeps a refund closed even when the booking has a no-show outcome", () => {
    const [row] = mapAdminFinanceRows({
      module: "payments",
      rows: [
        {
          booking_status: "no_show_therapist",
          financial_status: "refunded",
          id: "payment-refunded-no-show",
          service_status: "scheduled",
        },
      ],
    });

    expect(row.fields).toContainEqual({
      label: "Atendimento",
      value: "Encerrado",
    });
  });

  it("presents the V10 bank and compensation projection without internal terms", () => {
    const [row] = mapAdminFinanceRows({
      module: "payments",
      rows: [
        {
          currency: "BRL",
          debt_offset_amount_cents: 1000,
          financial_status: "paid",
          id: "payment-v10",
          payout_display_status: "bank_pending",
          therapist_amount_cents: 8500,
          transfer_effective_amount_cents: 7500,
          transfer_status: "transferred",
        },
      ],
    });

    expect(row.fields).toContainEqual({
      label: "Repasse",
      value: "A caminho do banco",
    });
    expect(row.fields).toContainEqual({
      label: "Compensação",
      value: "R$ 10,00",
    });
    expect(row.fields).toContainEqual({
      label: "Valor encaminhado",
      value: "R$ 75,00",
    });
    expect(JSON.stringify(row)).not.toMatch(
      /source_transaction|transfer reversal|paymentintent|payout_display_status/i,
    );
  });

  it("identifies a therapist-change refund review in the financial queue", () => {
    const [row] = mapAdminFinanceRows({
      module: "payments",
      rows: [
        {
          financial_review_status: "therapist_change_refund_review",
          financial_status: "paid",
          id: "payment-review",
          refund_pending: true,
          transfer_status: "blocked",
        },
      ],
    });

    expect(row.fields).toContainEqual({
      label: "Revisão TES",
      value: "Reembolso em análise",
    });
  });

  it("normalizes every transfer lifecycle status for administration", () => {
    expect(
      Object.fromEntries(
        [
          "not_eligible",
          "waiting_confirmation",
          "waiting_safety_period",
          "waiting_settlement",
          "eligible",
          "batched",
          "transfer_pending",
          "transferred",
          "blocked",
          "reversed",
          "failed",
        ].map((status) => [status, formatTransferStatus(status)]),
      ),
    ).toEqual({
      batched: "Em processamento",
      blocked: "Bloqueado",
      eligible: "Disponível para repasse",
      failed: "Falhou",
      not_eligible: "Ainda não elegível",
      reversed: "Repasse revertido",
      transfer_pending: "Em processamento",
      transferred: "Processando",
      waiting_confirmation: "Aguardando confirmação",
      waiting_safety_period: "Em liquidação",
      waiting_settlement: "Em liquidação",
    });
  });

  it("maps subscriptions without leaking billing provider references", () => {
    const [row] = mapAdminFinanceRows({
      module: "subscriptions",
      rows: [
        {
          cancel_at_period_end: true,
          current_period_end: "2026-09-08T00:00:00.000Z",
          current_period_start: "2026-08-08T00:00:00.000Z",
          id: "sub-local-1",
          plan_code: "premium_plus",
          status: "active",
          metadata: { raw: "hidden-subscription-metadata" },
          stripe_checkout_session_id: "cs_test_hidden",
          stripe_subscription_id: "sub_hidden",
          therapist_profile_id: "profile-abcdefghi",
          updated_at: "2026-08-08T12:00:00.000Z",
        },
      ],
    });

    expect(row.title).toBe("Assinatura Premium Plus");
    expect(row.statusLabel).toBe("active");
    expect(row.detailHref).toBe("/admin/assinaturas/sub-local-1");
    expect(JSON.stringify(row)).not.toContain("cs_test_hidden");
    expect(JSON.stringify(row)).not.toContain("sub_hidden");
    expect(JSON.stringify(row)).not.toContain("hidden-subscription-metadata");
  });

  it("maps payment details without exposing Stripe ids or raw metadata", () => {
    const detail = mapAdminFinanceDetail({
      events: [
        {
          amount_cents: 17000,
          currency: "BRL",
          direction: "credit",
          entry_type: "session_gross_payment",
          id: "ledger-1",
          kind: "ledger_entry",
          occurred_at: "2026-08-08T12:00:00.000Z",
          source_table: "session_payments",
          stripe_event_id: "evt_hidden",
        },
      ],
      generatedAt: "2026-08-08T12:00:00.000Z",
      module: "payments",
      record: {
        currency: "BRL",
        financial_status: "paid",
        gross_amount_cents: 17000,
        has_checkout_session: true,
        id: "payment-1",
        metadata: { raw: "hidden" },
        paid_at: "2026-08-08T12:00:00.000Z",
        service_title: "Reiki",
        stripe_checkout_session_id: "cs_test_hidden",
        stripe_payment_intent_id: "pi_hidden",
      },
    });

    expect(detail.backHref).toBe("/admin/pagamentos");
    expect(detail.title).toBe("Reiki");
    expect(JSON.stringify(detail)).not.toContain("cs_test_hidden");
    expect(JSON.stringify(detail)).not.toContain("pi_hidden");
    expect(JSON.stringify(detail)).not.toContain("evt_hidden");
    expect(JSON.stringify(detail)).not.toContain("hidden");
    expect(detail.sections).toContainEqual(
      expect.objectContaining({
        fields: expect.arrayContaining([
          expect.objectContaining({ label: "Pagamento confirmado em" }),
        ]),
        title: "Rastreabilidade",
      }),
    );
  });

  it("does not treat the existence of a payment attempt as financial confirmation", () => {
    const detail = mapAdminFinanceDetail({
      events: [],
      generatedAt: "2026-09-24T19:01:00.000Z",
      module: "payments",
      record: {
        financial_status: "failed",
        has_charge: true,
        has_payment_intent: true,
        id: "payment-failed-with-attempt",
        service_title: "Constelação Familiar",
      },
    });

    expect(detail.sections).toContainEqual(
      expect.objectContaining({
        fields: expect.arrayContaining([
          {
            label: "Tentativa de pagamento registrada",
            value: "Sim",
          },
        ]),
        title: "Conciliação segura",
      }),
    );
    expect(JSON.stringify(detail)).not.toContain("Pagamento confirmado");
  });

  it("presents the Stripe bank arrival as a civil date without timezone rollback", () => {
    const detail = mapAdminFinanceDetail({
      events: [],
      generatedAt: "2026-09-25T03:00:00.000Z",
      module: "payments",
      record: {
        bank_paid_at: "2026-09-25T00:00:00.000Z",
        bank_paid_date: "2026-09-25",
        financial_status: "paid",
        id: "payment-bank-date",
        payout_display_status: "paid",
      },
    });

    expect(detail.sections).toContainEqual(
      expect.objectContaining({
        fields: expect.arrayContaining([
          { label: "Pago ao banco em", value: "25/09/2026" },
        ]),
        title: "Risco e repasse",
      }),
    );
  });

  it("maps subscription details without exposing provider ids or invoice urls", () => {
    const detail = mapAdminFinanceDetail({
      events: [
        {
          amount_paid_cents: 12000,
          created_at: "2026-08-08T12:00:00.000Z",
          hosted_invoice_url: "https://invoice.hidden",
          id: "invoice-1",
          kind: "invoice",
          status: "paid",
          stripe_invoice_id: "in_hidden",
        },
      ],
      generatedAt: "2026-08-08T12:00:00.000Z",
      module: "subscriptions",
      record: {
        customer_email_present: true,
        customer_linked: true,
        has_subscription_reference: true,
        id: "subscription-1",
        metadata: { raw: "hidden" },
        plan_code: "premium_plus",
        status: "active",
        stripe_subscription_id: "sub_hidden",
        therapist_name: "Ana Oliveira",
      },
    });

    expect(detail.backHref).toBe("/admin/assinaturas");
    expect(detail.title).toBe("Assinatura Premium Plus");
    expect(JSON.stringify(detail)).not.toContain("sub_hidden");
    expect(JSON.stringify(detail)).not.toContain("in_hidden");
    expect(JSON.stringify(detail)).not.toContain("invoice.hidden");
    expect(JSON.stringify(detail)).not.toContain("hidden");
  });

  it("maps report rows as planned read-only exports", () => {
    const [row] = mapAdminFinanceRows({
      module: "reports",
      rows: [
        {
          description: "Pagamentos, refunds, disputes, ledger e repasses.",
          export_status: "Pendente de comando auditado",
          id: "payments",
          privacy: "Mínimo necessário",
          scope: "Admin read-only",
          source: "session_payments",
          status: "Planejado",
          title: "Relatório financeiro",
        },
      ],
    });

    expect(row.title).toBe("Relatório financeiro");
    expect(row.statusLabel).toBe("Planejado");
    expect(row.fields).toContainEqual({
      label: "Exportação",
      value: "Pendente de comando auditado",
    });
  });
});
