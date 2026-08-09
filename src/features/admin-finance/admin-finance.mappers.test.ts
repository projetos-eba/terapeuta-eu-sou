import { describe, expect, it } from "vitest";

import {
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
          platform_gross_commission_cents: 3400,
          refund_pending: false,
          service_status: "completed",
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
      "Profissional",
      "Atendimento",
      "Transferência",
      "Valor bruto",
      "Repasse terapeuta",
      "Comissão TES",
      "Reembolso pendente",
      "Atualizado",
    ]);
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
