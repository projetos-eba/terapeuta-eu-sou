import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AdminOperationPageData } from "../admin-operations.types";
import { AdminReviewsPage } from "./admin-reviews-page";

describe("AdminReviewsPage", () => {
  it("uses an operational table with a rating filter and no side rail", () => {
    const html = renderToStaticMarkup(<AdminReviewsPage data={pageData()} />);

    expect(html).toContain("Avaliações recentes");
    expect(html).toContain("name=\"rating\"");
    expect(html).toContain("Todas as notas");
    expect(html).toContain("5 estrelas");
    expect(html).toContain("<table");
    ["Avaliação", "Profissional", "Nota", "Situação", "Data", "Ação"].forEach(
      (label) => expect(html).toContain(label),
    );
    expect(html).toContain("5 de 5 estrelas");
    expect(html).toContain("Ver detalhes");
    expect(html).not.toContain("Guardrails");
    expect(html).not.toContain("Comentário que não deve aparecer");
  });
});

function pageData(): AdminOperationPageData {
  return {
    description: "",
    emptyMessage: "Nenhuma avaliação disponível para esta consulta.",
    filterOptions: {
      sort: [{ label: "Mais recentes", value: "recent" }],
      status: [
        { label: "Todos os status", value: "" },
        { label: "Publicadas", value: "published" },
      ],
    },
    generatedAt: "2026-09-26T20:20:00.000Z",
    listHref: "/admin/avaliacoes",
    metrics: [
      {
        description: "Registros recebidos.",
        key: "total-reviews",
        label: "Avaliações",
        source: "reviews",
        status: "available",
        tone: "info",
        value: 1,
      },
    ],
    page: { hasNext: false, page: 1, pageSize: 12, total: 1 },
    query: { page: 1, pageSize: 12, rating: "5", search: "", sort: "recent", status: "" },
    rows: [
      {
        detailHref: "/admin/avaliacoes/review-1",
        fields: [
          { label: "Terapeuta", value: "Ana Clara" },
          { label: "Nota", value: "5" },
          { label: "Publicada", value: "14/09/2026, 10:21" },
          { label: "Comentário", value: "Comentário que não deve aparecer" },
        ],
        id: "review-1",
        statusLabel: "published",
        subtitle: "Booking 10342f43",
        title: "Avaliação operacional",
      },
    ],
    rowsStatus: "available",
    safetyNotes: [],
    sourceLabel: "Avaliações",
    title: "Avaliações",
  };
}
