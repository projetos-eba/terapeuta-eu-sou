import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AdminOperationPageData } from "../admin-operations.types";
import { AdminVerificationsPage } from "./admin-verifications-page";

describe("AdminVerificationsPage", () => {
  it("keeps approval pending publication in the purple operational state", () => {
    const html = renderToStaticMarkup(
      <AdminVerificationsPage
        data={pageData({
          statusLabel: "Aprovado · falta publicar",
        })}
      />,
    );

    expect(html).toContain("Aprovado · falta publicar");
    expect(html).toContain("bg-brand-lavenderSoft text-brand-primary");
    expect(html).not.toContain("bg-status-successBg text-status-success");
  });

  it("uses green only for a profile that is public and eligible", () => {
    const html = renderToStaticMarkup(
      <AdminVerificationsPage
        data={pageData({ statusLabel: "Publicado e elegível" })}
      />,
    );

    expect(html).toContain("Publicado e elegível");
    expect(html).toContain("bg-status-successBg text-status-success");
  });
});

function pageData({ statusLabel }: { statusLabel: string }): AdminOperationPageData {
  return {
    description: "",
    emptyMessage: "",
    filterOptions: {
      sort: [{ label: "Mais recentes", value: "recent" }],
      status: [{ label: "Todos os status", value: "" }],
    },
    generatedAt: "2026-09-16T12:00:00.000Z",
    listHref: "/admin/profissionais/verificacoes",
    metrics: [],
    page: {
      hasNext: false,
      page: 1,
      pageSize: 10,
      total: 1,
    },
    query: {
      page: 1,
      pageSize: 10,
      search: "",
      sort: "recent",
      status: "",
    },
    rows: [
      {
        detailHref: "/admin/profissionais/therapist-1",
        fields: [
          { label: "Enviado", value: "16/09/2026, 09:00" },
          { label: "Revisado", value: "16/09/2026, 09:20" },
        ],
        id: "verification-1",
        statusLabel,
        title: "Terapeuta 01",
      },
    ],
    rowsStatus: "available",
    safetyNotes: [],
    sourceLabel: "Supabase",
    title: "Verificações",
  };
}
