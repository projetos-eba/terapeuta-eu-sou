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
          fields: [{ label: "Valor bruto", value: "R$ 180,00" }],
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
    expect(html).not.toContain("PaymentIntent");
    expect(html).not.toContain("Metadados internos");
  });
});
