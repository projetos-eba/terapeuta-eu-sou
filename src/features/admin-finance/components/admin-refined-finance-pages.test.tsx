import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  AdminFinanceDetailPageData,
  AdminFinancePageData,
} from "../admin-finance.types";
import { AdminPaymentDetailPage } from "./admin-payment-detail-page";
import { AdminPaymentsPage } from "./admin-payments-page";
import { AdminSubscriptionsPage } from "./admin-subscriptions-page";

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
              key: "net-platform-revenue-amount",
              label: "Receita líquida TES",
              source: "",
              status: "available",
              tone: "success",
              value: 15000,
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
    expect(html).toContain("Receita líquida TES");
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
});
