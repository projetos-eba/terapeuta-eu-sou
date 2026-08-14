import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AdminOperationPageData } from "../admin-operations.types";
import { AdminProfessionalsPage } from "./admin-professionals-page";

const baseData: AdminOperationPageData = {
  description: "",
  emptyMessage: "Nenhum profissional acessível para esta sessão.",
  filterOptions: {
    sort: [
      { label: "Mais recentes", value: "recent" },
      { label: "Nome", value: "name" },
    ],
    status: [
      { label: "Todos os status", value: "" },
      { label: "Aguardando análise", value: "submitted" },
    ],
  },
  generatedAt: "2026-08-14T12:00:00.000Z",
  listHref: "/admin/profissionais",
  metrics: [
    {
      description: "Perfis de terapeuta.",
      key: "total-professionals",
      label: "Profissionais",
      source: "therapist_profiles",
      status: "available",
      tone: "info",
      value: 12,
    },
    {
      description: "Profissionais com cadastro aprovado.",
      key: "approved-professionals",
      label: "Aprovados",
      source: "therapist_profiles",
      status: "available",
      tone: "success",
      value: 7,
    },
    {
      description: "Perfis públicos ativos.",
      key: "public-professionals",
      label: "Publicados",
      source: "therapist_profiles",
      status: "available",
      tone: "success",
      value: 5,
    },
    {
      description: "Profissionais aceitando reservas.",
      key: "booking-professionals",
      label: "Recebendo reservas",
      source: "therapist_profiles",
      status: "available",
      tone: "info",
      value: 4,
    },
  ],
  page: { hasNext: false, page: 1, pageSize: 12, total: 1 },
  query: { page: 1, pageSize: 12, search: "", sort: "recent", status: "" },
  rows: [
    {
      detailHref: "/admin/profissionais/professional-1",
      fields: [
        { label: "Plano", value: "premium_plus" },
        { label: "Perfil público", value: "published" },
        { label: "Reservas", value: "Sim" },
        { label: "Serviços", value: "3" },
        { label: "Atualizado", value: "14/08/2026" },
      ],
      id: "professional-1",
      statusLabel: "submitted",
      subtitle: "ana-oliveira",
      title: "Ana Oliveira",
    },
  ],
  rowsStatus: "available",
  safetyNotes: [],
  sourceLabel: "therapist_profiles",
  title: "Profissionais",
};

describe("AdminProfessionalsPage", () => {
  it("prioritizes identity, status and an explicit detail action", () => {
    const html = renderToStaticMarkup(
      <AdminProfessionalsPage data={baseData} />,
    );

    expect(html).toContain("Lista de profissionais");
    expect(html).toContain("Ana Oliveira");
    expect(html).toContain("Aguardando análise");
    expect(html).toContain("Revisão pendente");
    expect(html).toContain("Ver profissional");
    expect(html).toContain("Ver verificações");
    expect(html).toContain("1</strong> profissional nesta página");
    expect(html).toContain("1 perfil pede acompanhamento");
    expect(html).not.toContain("Crescimento da base");
    expect(html).not.toContain("Distribuição por plano");
    expect(html).not.toContain("Stripe Connect");
    expect(html).not.toContain("therapist_profiles");
  });

  it("uses the canonical copy for a rejected professional", () => {
    const html = renderToStaticMarkup(
      <AdminProfessionalsPage
        data={{
          ...baseData,
          rows: [{ ...baseData.rows[0], statusLabel: "rejected" }],
        }}
      />,
    );

    expect(html).toContain("Não aprovado");
    expect(html).not.toContain("Reprovado");
  });

  it("distinguishes zero results from a real empty list", () => {
    const filteredHtml = renderToStaticMarkup(
      <AdminProfessionalsPage
        data={{
          ...baseData,
          page: { ...baseData.page, total: 0 },
          query: { ...baseData.query, search: "não existe" },
          rows: [],
        }}
      />,
    );
    const emptyHtml = renderToStaticMarkup(
      <AdminProfessionalsPage
        data={{
          ...baseData,
          page: { ...baseData.page, total: 0 },
          rows: [],
        }}
      />,
    );

    expect(filteredHtml).toContain("Nenhum resultado para estes filtros");
    expect(filteredHtml).toContain("Limpar filtros");
    expect(emptyHtml).toContain("Nenhum profissional disponível");
    expect(emptyHtml).not.toContain("Nenhum resultado para estes filtros");
  });

  it("does not present an unavailable read as an empty state", () => {
    const html = renderToStaticMarkup(
      <AdminProfessionalsPage
        data={{
          ...baseData,
          metrics: baseData.metrics.map((metric) => ({
            ...metric,
            status: "unavailable" as const,
            value: null,
          })),
          page: { ...baseData.page, total: 0 },
          rows: [],
          rowsStatus: "unavailable",
        }}
      />,
    );

    expect(html).toContain("Profissionais indisponíveis");
    expect(html).toContain("Informação indisponível agora.");
    expect(html).not.toContain("Nenhum profissional disponível");
  });

  it("distinguishes forbidden access from an unavailable read", () => {
    const html = renderToStaticMarkup(
      <AdminProfessionalsPage
        data={{
          ...baseData,
          metrics: baseData.metrics.map((metric) => ({
            ...metric,
            status: "forbidden" as const,
            value: null,
          })),
          page: { ...baseData.page, total: 0 },
          rows: [],
          rowsStatus: "forbidden",
        }}
      />,
    );

    expect(html).toContain("Acesso restrito");
    expect(html).not.toContain("Profissionais indisponíveis");
    expect(html).not.toContain("Nenhum profissional disponível");
  });
});
