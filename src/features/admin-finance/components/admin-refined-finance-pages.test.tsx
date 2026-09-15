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

  it("shows compensation and the effective bank-bound amount without internal wording", () => {
    const html = renderToStaticMarkup(
      <AdminPaymentsPage
        data={financeData({
          rows: [
            {
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

    expect(html).toContain("Repasse previsto: R$ 85,00");
    expect(html).toContain("Compensação: R$ 10,00");
    expect(html).toContain("Valor encaminhado: R$ 75,00");
    expect(html).toContain("A caminho do banco");
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
    expect(html).toContain("Pagamento processado");
    expect(html).toContain("Repasse previsto");
    expect(html).toContain("Compensação");
    expect(html).toContain("Valor encaminhado");
    expect(html).not.toContain("PaymentIntent");
    expect(html).not.toContain("Metadados internos");
  });
});
