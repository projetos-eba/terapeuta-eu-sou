import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PublicTherapyDetail } from "../../types/therapy-detail";
import { TherapyDetailPage } from "./therapy-detail-page";

vi.mock("./related-therapists-match-client", () => ({
  RelatedTherapistsMatchClient: () => null,
}));

const therapy: PublicTherapyDetail = {
  approachIconKey: "sparkles",
  approachLabel: "Terapia",
  benefits: [],
  themes: [{ name: "Bem-estar", slug: "bem-estar" }],
  complementaryDescription: null,
  description: "Descrição",
  heroFocalPoint: "center",
  heroImageUrl: null,
  highlights: [],
  id: "therapy-1",
  introduction: "Introdução",
  name: "Reiki",
  safetyNote: null,
  seoDescription: null,
  seoTitle: null,
  shortDescription: "Descrição curta",
  slug: "reiki",
  subtitle: "Subtítulo",
  therapistCount: 0,
  visualThemeKey: "energy",
};

describe("TherapyDetailPage", () => {
  it("encerra o detalhe com o banner de descoberta compartilhado", () => {
    render(
      <TherapyDetailPage
        relatedTherapists={[]}
        source="directory"
        sort="relevance"
        therapy={therapy}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Encontre um caminho que faça sentido para você",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver terapeutas" }),
    ).toHaveAttribute("href", "/terapeutas");
    expect(
      screen.queryByText("Cada pessoa é única, e cada caminho também."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Perguntas frequentes")).not.toBeInTheDocument();
  });
});
