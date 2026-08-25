import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AdminOperationPageData } from "../admin-operations.types";
import { AdminOperationalOverviewPage } from "./admin-operational-overview-page";

const baseData: AdminOperationPageData = {
  description: "",
  emptyMessage: "",
  filterOptions: {
    sort: [{ label: "Mais recentes", value: "recent" }],
    status: [{ label: "Todos", value: "" }],
  },
  generatedAt: "2026-08-11T12:00:00.000Z",
  listHref: "/admin/sessoes",
  metrics: [
    {
      description: "Reservas registradas.",
      key: "total-sessions",
      label: "Sessões",
      source: "bookings",
      status: "available",
      tone: "info",
      value: 4,
    },
  ],
  page: { hasNext: false, page: 1, pageSize: 10, total: 1 },
  query: { page: 1, pageSize: 10, search: "", sort: "recent", status: "" },
  rows: [
    {
      detailHref: "/admin/sessoes/session-1",
      fields: [
        { label: "Terapeuta", value: "Ana Oliveira" },
        { label: "Cliente", value: "Marina Rocha" },
        { label: "Pagamento", value: "paid" },
        { label: "Início", value: "11/08/2026, 14:00" },
        { label: "Duração", value: "50 min" },
      ],
      id: "session-1",
      statusLabel: "confirmed",
      subtitle: "Booking session-1",
      title: "Aromaterapia",
    },
  ],
  rowsStatus: "available",
  safetyNotes: [],
  sourceLabel: "bookings",
  title: "Sessões",
};

describe("AdminOperationalOverviewPage", () => {
  it("renders the sessions workspace without technical list copy", () => {
    const html = renderToStaticMarkup(
      <AdminOperationalOverviewPage data={baseData} module="sessions" />,
    );

    expect(html).toContain("Agenda de sessões");
    expect(html).toContain("Ana Oliveira");
    expect(html).toContain("ID: session-1");
    expect(html).not.toContain("Booking session-1");
    expect(html).not.toContain("bookings");
  });

  it("renders the support workspace with module-specific language", () => {
    const html = renderToStaticMarkup(
      <AdminOperationalOverviewPage
        data={{
          ...baseData,
          listHref: "/admin/suporte",
          rows: [],
          title: "Suporte",
        }}
        module="support"
      />,
    );

    expect(html).toContain("Fila de atendimento");
    expect(html).toContain("Nenhuma solicitação encontrada");
    expect(html).not.toContain("sessão administrativa atual");
  });
});
