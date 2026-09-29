import { describe, expect, it } from "vitest";

import { buildAdminFinanceCsv } from "./admin-finance.export";
import type { AdminFinancePageData } from "./admin-finance.types";

describe("buildAdminFinanceCsv", () => {
  it("uses human sections, protects spreadsheets, and omits technical identifiers", () => {
    const data: AdminFinancePageData = {
      description: "",
      emptyMessage: "",
      filterOptions: { sort: [], status: [] },
      generatedAt: "2026-09-29T12:00:00.000Z",
      listHref: "/admin/pagamentos",
      metrics: [
        {
          description: "",
          key: "total-payments-amount",
          label: "Total de pagamentos",
          source: "session_payments",
          status: "available",
          tone: "info",
          value: 11990,
        },
      ],
      page: { hasNext: false, page: 1, pageSize: 50, total: 1 },
      query: { end: "2026-09-29", page: 1, pageSize: 50, period: "custom", search: "", sort: "", start: "2026-09-01", status: "" },
      rows: [
        {
          fields: [
            { label: "Atendimento", value: "Concluído" },
            { label: "Cliente", value: "'=1+1" },
            { label: "Profissional", value: "Maria" },
            { label: "Valor bruto", value: "R$ 119,90" },
          ],
          id: "payment-internal-id",
          statusLabel: "paid",
          subtitle: "Reserva 123",
          title: "Pagamento de sessão",
        },
      ],
      rowsStatus: "available",
      rowsTitle: "",
      safetyNotes: [],
      sourceLabel: "session_payments",
      title: "Financeiro",
    };

    const csv = buildAdminFinanceCsv({
      data,
      generatedAt: new Date("2026-09-29T12:00:00.000Z"),
    });

    expect(csv.startsWith("\ufeffRelatório financeiro\r\n")).toBe(true);
    expect(csv).toContain("Informações do relatório");
    expect(csv).toContain("Resumo das métricas");
    expect(csv).toContain("Transações do período");
    expect(csv).toContain("Indicadores complementares");
    expect(csv).toContain("Total de pagamentos;R$ 119,90;Disponível");
    expect(csv).toContain(";'=1+1;");
    expect(csv).not.toContain("payment-internal-id");
    expect(csv).not.toContain("session_payments");
  });
});
