import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RelatedTherapists } from "./related-therapists";

const therapy = {
  approachIconKey: "sparkles",
  approachLabel: "Terapia",
  benefits: [],
  category: { name: "Bem-estar", slug: "bem-estar" },
  complementaryDescription: null,
  description: "Descrição",
  faqs: [],
  heroFocalPoint: "center" as const,
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
  therapistCount: 1,
  visualThemeKey: "energy" as const,
};

const therapist = {
  averageRating: null,
  completedSessionCount: 0,
  headline: "Terapeuta TES",
  isAcceptingBookings: true,
  isPremium: true,
  matchingInterestCount: 2,
  matchingServiceThemeCount: 1,
  name: "Ana Oliveira",
  nextSlotAt: null,
  photoUrl: null,
  reviewCount: 0,
  serviceDescription: "Atendimento publicado.",
  slug: "ana-oliveira",
  tags: ["Autoconhecimento"],
};

describe("RelatedTherapists", () => {
  afterEach(cleanup);

  it("explica e exibe a pontuação de interesses no contexto do Match", () => {
    render(
      <RelatedTherapists
        matchContextActive
        source="match"
        sort="relevance"
        therapists={[therapist]}
        therapy={therapy}
      />,
    );

    expect(
      screen.getByText("Mais compatível com o que você busca"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Esses terapeutas têm mais compatibilidade com o que você está buscando.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Ana Oliveira é terapeuta Premium"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Ordenar por:")).not.toBeInTheDocument();
  });

  it("não apresenta uma pontuação nula como correspondência", () => {
    render(
      <RelatedTherapists
        matchContextActive
        source="match"
        sort="relevance"
        therapists={[
          {
            ...therapist,
            matchingInterestCount: 0,
            matchingServiceThemeCount: 0,
          },
        ]}
        therapy={therapy}
      />,
    );

    expect(screen.getByText("Trabalha com esta terapia")).toBeInTheDocument();
    expect(
      screen.queryByText("Mais compatível com o que você busca"),
    ).not.toBeInTheDocument();
  });

  it("mantém apresentações contínuas dentro do card no mobile", () => {
    const longDescription = "d".repeat(120);

    render(
      <RelatedTherapists
        matchContextActive={false}
        source="directory"
        sort="relevance"
        therapists={[{ ...therapist, serviceDescription: longDescription }]}
        therapy={therapy}
      />,
    );

    expect(screen.getByText(longDescription)).toHaveClass(
      "break-words",
      "[overflow-wrap:anywhere]",
    );
    expect(screen.getByRole("article")).toHaveClass("min-w-0");
  });
});
