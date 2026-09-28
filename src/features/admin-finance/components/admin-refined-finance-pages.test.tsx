import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type {
  AdminFinanceDetailPageData,
  AdminFinancePageData,
} from "../admin-finance.types";
import { AdminPaymentDetailPage } from "./admin-payment-detail-page";
import { AdminPaymentsPage } from "./admin-payments-page";
import { AdminSubscriptionDetailPage } from "./admin-subscription-detail-page";
import { AdminSubscriptionsPage } from "./admin-subscriptions-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function financeData(
  overrides: Partial<AdminFinancePageData> = {},
): AdminFinancePageData {
  return {
    description: "",
    emptyMessage: "",
    filterOptions: {
      sort: [{ label: "Mais recentes", value: "recent" }],
      status: [{ label: "Todos", value: "" }],
    },
    generatedAt: "2026-08-11T12:00:00.000Z",
    listHref: "/admin/pagamentos",
    metrics: [],
    page: { hasNext: false, page: 1, pageSize: 10, total: 0 },
    query: { page: 1, pageSize: 10, search: "", sort: "recent", status: "" },
    rows: [],
    rowsStatus: "available",
    rowsTitle: "",
    safetyNotes: [],
    sourceLabel: "technical_source",
    title: "Financeiro",
    ...overrides,
  };
}

describe("refined admin finance pages", () => {
  it("renders payments inside the refined financial workspace", () => {
    const html = renderToStaticMarkup(
      <AdminPaymentsPage data={financeData()} />,
    );

    expect(html).toContain("Transações e repasses");
    expect(html).toContain("Indicadores operacionais");
    expect(html).not.toContain("technical_source");
  });

  it("renders the financial amount cards, period filter and operational table columns", () => {
    const html = renderToStaticMarkup(
      <AdminPaymentsPage
        data={financeData({
          filterOptions: {
            period: [
              { label: "Últimos 7 dias", value: "7d" },
              { label: "Últimos 30 dias", value: "30d" },
              { label: "Últimos 90 dias", value: "90d" },
            ],
            sort: [{ label: "Mais recentes", value: "recent" }],
            status: [{ label: "Todos", value: "" }],
          },
          metrics: [
            {
              description: "",
              key: "total-payments-amount",
              label: "Total de pagamentos",
              source: "",
              status: "available",
              tone: "info",
              value: 120000,
            },
            {
              description: "",
              key: "gross-platform-commission-amount",
              label: "Comissão bruta TES",
              source: "",
              status: "available",
              tone: "success",
              value: 18000,
            },
            {
              description: "",
              key: "stripe-fees-amount",
              label: "Taxas Stripe",
              source: "",
              status: "available",
              tone: "warning",
              value: 3000,
            },
            {
              description: "",
              key: "canceled-payment-amount",
              label: "Pagamentos cancelados",
              source: "",
              status: "available",
              tone: "danger",
              value: 15000,
            },
            {
              description: "",
              key: "pending-refunds-amount",
              label: "Reembolsos pendentes",
              source: "",
              status: "available",
              tone: "warning",
              value: 2000,
            },
            {
              description: "",
              key: "completed-refunds-amount",
              label: "Reembolsos concluídos",
              source: "",
              status: "available",
              tone: "success",
              value: 3000,
            },
          ],
          page: { hasNext: false, page: 1, pageSize: 10, total: 1 },
          query: {
            page: 1,
            pageSize: 10,
            period: "30d",
            search: "",
            sort: "recent",
            status: "",
          },
          rows: [
            {
              fields: [
                { label: "Cliente", value: "Mariana Souza" },
                { label: "Data e hora", value: "26/09/2026, 10:00" },
                { label: "Forma de pagamento", value: "Pix" },
              ],
              id: "payment-1",
              statusLabel: "paid",
              title: "Sessão de teste",
            },
          ],
        })}
      />,
    );

    expect(html).toContain("Últimos 30 dias");
    expect(html).toContain("Total de pagamentos");
    expect(html).toContain("Comissão bruta TES");
    expect(html).toContain("Taxas Stripe");
    expect(html).toContain("Pagamentos cancelados");
    expect(html).toContain("Entenda Pagamentos cancelados");
    expect(html).toContain("Não inclui pagamentos com falha.");
    expect(html).toContain("Reembolsos");
    expect(html).toContain("Pendentes");
    expect(html).toContain("Concluídos");
    expect(html).toContain("Entenda Pendentes");
    expect(html).toContain("Entenda Concluídos");
    expect(html).toContain("R$ 20,00");
    expect(html).toContain("R$ 30,00");
    expect(html).not.toContain("Reembolsos pendentes");
    expect(html).not.toMatch(/<p\b[^>]*>(?:(?!<\/p>).)*<details\b/s);
    expect(html).not.toContain("Receita líquida TES");
    expect(html).toContain("R$ 1.200,00");
    expect(html).toContain("Forma de pagamento");
    expect(html).toContain("Data e hora");
  });

  it("shows compensation and the effective bank-bound amount without internal wording", () => {
    const html = renderToStaticMarkup(
      <AdminPaymentsPage
        data={financeData({
          rows: [
            {
              detailHref: "/admin/pagamentos/payment-v10",
              id: "payment-v10",
              fields: [
                { label: "Valor bruto", value: "R$ 100,00" },
                { label: "Repasse terapeuta", value: "R$ 85,00" },
                { label: "Compensação", value: "R$ 10,00" },
                { label: "Valor encaminhado", value: "R$ 75,00" },
                { label: "Custos da plataforma", value: "R$ 15,00" },
                { label: "Repasse", value: "A caminho do banco" },
              ],
              statusLabel: "paid",
              title: "Reiki online",
            },
          ],
        })}
      />,
    );

    expect(html).toContain("Repasse: R$ 85,00");
    expect(html).toContain("Compensação");
    expect(html).toContain("Valor encaminhado");
    expect(html).toContain("A caminho do banco");
    expect(html).not.toContain("Abrir avaliação de reembolso da sessão");
    expect(html).not.toContain(">Reembolso</a>");
    expect(html).toContain("Ver detalhes");
    expect(html).not.toMatch(
      /source_transaction|transfer reversal|payout_display_status/i,
    );
  });

  it("renders subscriptions with honest empty-state copy", () => {
    const html = renderToStaticMarkup(
      <AdminSubscriptionsPage
        data={financeData({
          listHref: "/admin/assinaturas",
          title: "Assinaturas",
        })}
      />,
    );

    expect(html).toContain("Assinaturas recentes");
    expect(html).toContain("Nenhuma assinatura encontrada");
    expect(html).not.toContain("technical_source");
    expect(html).not.toContain("server-side");
  });

  it("renders the subscription cards, filters and complete operational columns", () => {
    const html = renderToStaticMarkup(
      <AdminSubscriptionsPage
        data={financeData({
          description: "Acompanhe planos e cobranças.",
          filterOptions: {
            plan: [
              { label: "Todos os planos", value: "" },
              { label: "Premium", value: "premium" },
            ],
            period: [{ label: "Últimos 30 dias", value: "30d" }],
            sort: [{ label: "Mais recentes", value: "recent" }],
            status: [
              { label: "Todas as situações", value: "" },
              { label: "Ativas", value: "active" },
            ],
          },
          listHref: "/admin/assinaturas",
          metrics: [
            metric("paid-subscriptions", "Total de assinaturas pagas", 18),
            metric("free-therapists", "Free", 6),
            metric("premium-therapists", "Premium", 8),
            metric("premium-plus-therapists", "Premium Plus", 10),
            metric("canceled-subscriptions", "Assinaturas canceladas", 2),
          ],
          page: { hasNext: false, page: 1, pageSize: 12, total: 1 },
          query: {
            page: 1,
            pageSize: 12,
            period: "30d",
            plan: "premium",
            search: "",
            sort: "recent",
            status: "active",
          },
          rows: [
            {
              detailHref: "/admin/assinaturas/subscription-1",
              fields: [
                { label: "Terapeuta", value: "Mariana Silva" },
                { label: "Plano atual", value: "Premium" },
                { label: "Início do ciclo", value: "01/09/2026, 10:00" },
                { label: "Próxima cobrança", value: "01/10/2026, 10:00" },
                { label: "Última cobrança", value: "01/09/2026, 10:00 · Paga" },
              ],
              id: "subscription-1",
              statusLabel: "active",
              title: "Assinatura Premium",
            },
          ],
          title: "Assinaturas",
        })}
      />,
    );

    expect(html).toContain("Total de assinaturas pagas");
    expect(html).toContain("Premium Plus");
    expect(html).toContain("Assinaturas canceladas");
    expect(html).toContain("Buscar por profissional");
    expect(html).toContain("Todos os planos");
    expect(html).toContain("Últimos 30 dias");
    expect(html).toContain("Plano atual");
    expect(html).toContain("Próxima cobrança / renovação");
    expect(html).toContain("Última cobrança");
    expect(html).toContain("Mariana Silva");
    expect(html).toContain("Ver detalhes");
    expect(html).not.toContain("Planos nesta página");
    expect(html).not.toContain("Indicadores complementares");
  });

  it("renders payment details without internal reconciliation labels", () => {
    const data: AdminFinanceDetailPageData = {
      backHref: "/admin/pagamentos",
      events: [],
      generatedAt: "2026-08-11T12:00:00.000Z",
      id: "00000000-0000-4000-8000-000000000002",
      module: "payments",
      safetyNotes: [],
      sections: [
        {
          fields: [{ label: "Status financeiro", value: "paid" }],
          title: "Pagamento",
        },
        {
          fields: [
            { label: "Valor bruto", value: "R$ 180,00" },
            { label: "Repasse terapeuta", value: "R$ 153,00" },
            { label: "Compensação", value: "R$ 10,00" },
            { label: "Valor encaminhado", value: "R$ 143,00" },
          ],
          title: "Valores",
        },
        {
          fields: [{ label: "Terapeuta", value: "Ana Oliveira" }],
          title: "Participantes e sessão",
        },
        {
          fields: [
            { label: "PaymentIntent recebido", value: "Sim" },
            { label: "Metadados internos presentes", value: "Sim" },
          ],
          title: "Conciliação segura",
        },
      ],
      statusLabel: "paid",
      title: "Aromaterapia",
    };
    const html = renderToStaticMarkup(<AdminPaymentDetailPage data={data} />);

    expect(html).toContain("Detalhes do financeiro");
    expect(html).toContain("Tentativa de pagamento registrada");
    expect(html).toContain("Repasse previsto");
    expect(html).toContain("Compensação");
    expect(html).toContain("Valor encaminhado");
    expect(html).not.toContain("PaymentIntent");
    expect(html).not.toContain("Metadados internos");
  });

  it("renders a canceled payment as canceled instead of under review", () => {
    const html = renderToStaticMarkup(
      <AdminPaymentDetailPage
        data={{
          backHref: "/admin/pagamentos",
          events: [],
          generatedAt: "2026-09-22T18:00:00.000Z",
          id: "payment-canceled",
          module: "payments",
          safetyNotes: [],
          sections: [],
          statusLabel: "canceled",
          title: "Constelação Familiar",
        }}
      />,
    );

    expect(html).toContain("Cancelado");
    expect(html).not.toContain("Em análise");
  });

  it("renders the subscription detail with the operational sections and scheduled cancellation action", () => {
    const html = renderToStaticMarkup(
      <AdminSubscriptionDetailPage
        data={{
          backHref: "/admin/assinaturas",
          events: [
            {
              createdAt: "2026-09-27T12:00:00.000Z",
              id: "event-1",
              kind: "subscription_event",
              subtitle: "Ativa → Cancelada",
              title: "Cancelamento programado",
            },
          ],
          generatedAt: "2026-09-27T12:00:00.000Z",
          id: "00000000-0000-4000-8000-000000000001",
          module: "subscriptions",
          safetyNotes: [],
          sections: [
            {
              fields: [
                { label: "Terapeuta", value: "Mariana Silva" },
                { label: "Plano atual", value: "Premium" },
                { label: "Situação da assinatura", value: "Ativa" },
              ],
              title: "Assinatura",
            },
            {
              fields: [
                { label: "Início do ciclo", value: "01/09/2026, 09:00" },
                { label: "Próxima cobrança", value: "01/10/2026, 09:00" },
                { label: "Valor do ciclo", value: "R$ 79,90" },
              ],
              title: "Ciclo e preço",
            },
            {
              fields: [{ label: "Assinatura registrada", value: "Sim" }],
              title: "Conciliação segura",
            },
            {
              fields: [{ label: "Cobranças pagas", value: "2" }],
              title: "Últimas cobranças",
            },
            {
              fields: [{ label: "Atualizado em", value: "27/09/2026, 09:00" }],
              title: "Rastreabilidade",
            },
          ],
          statusLabel: "active",
          subscriptionManagement: {
            available: true,
            cancelAtPeriodEnd: false,
          },
          title: "Assinatura Premium",
        }}
      />,
    );

    expect(html).toContain("Detalhes da assinatura");
    expect(html).toContain("Conciliação segura");
    expect(html).toContain("Últimas cobranças");
    expect(html).toContain("Rastreabilidade");
    expect(html).toContain("Cancelar assinatura");
    expect(html).toContain("Cancelamento programado");
    expect(html).not.toContain("stripe_subscription_id");
  });
});

function metric(key: string, label: string, value: number) {
  return {
    description: "Leitura atual da plataforma.",
    key,
    label,
    source: "",
    status: "available" as const,
    tone: "info" as const,
    value,
  };
}
