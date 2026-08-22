import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AdminSupportInboxData } from "../admin-support-inbox";
import { AdminSupportInboxPage } from "./admin-support-inbox-page";

const data: AdminSupportInboxData = {
  attentionCount: 1,
  categories: ["financeiro_repasses"],
  page: { hasNext: false, page: 1, pageSize: 12, total: 1 },
  query: {
    assignment: "",
    category: "",
    page: 1,
    pageSize: 12,
    persona: "",
    priority: "",
    search: "",
    status: "",
  },
  rows: [
    {
      assignedAdminId: null,
      assignedAdminName: null,
      bookingId: null,
      category: "financeiro_repasses",
      createdAt: "2026-08-21T12:00:00.000Z",
      id: "11111111-1111-4111-8111-111111111111",
      lastActivityAt: "2026-08-21T12:00:00.000Z",
      priority: "high",
      requesterName: "Ana Oliveira",
      requesterRole: "therapist",
      status: "waiting_support",
      subject: "Dúvida sobre repasse",
    },
  ],
};

describe("AdminSupportInboxPage", () => {
  it("prioritizes the operational attention state without KPI cards", () => {
    const html = renderToStaticMarkup(<AdminSupportInboxPage data={data} />);
    expect(html).toContain("Precisa de atenção");
    expect(html).toContain("Aguardando TES");
    expect(html).toContain("Dúvida sobre repasse");
    expect(html).toContain("Financeiro e repasses");
    expect(html).not.toContain("Chamados registrados");
  });

  it("distinguishes a filtered zero-result state", () => {
    const html = renderToStaticMarkup(
      <AdminSupportInboxPage
        data={{
          ...data,
          query: { ...data.query, status: "resolved" },
          rows: [],
        }}
      />,
    );
    expect(html).toContain("Nenhum chamado corresponde aos filtros");
    expect(html).toContain("Limpar filtros");
  });
});
