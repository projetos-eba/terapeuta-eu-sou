import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RelatedTherapists } from "./related-therapists";

const therapy = {
  approachIconKey: "sparkles",
  approachLabel: "Terapia",
  benefits: [],
  themes: [{ name: "Bem-estar", slug: "bem-estar" }],
  complementaryDescription: null,
  description: "Descrição",
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
  guideThemes: ["Autoconhecimento"],
};

describe("RelatedTherapists", () => {
  afterEach(cleanup);

  it("explica e exibe a pontuação de interesses no contexto do Match", () => {
    render(
      <RelatedTherapists
        matchContextActive
        source="match"
        sort="az"
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
    expect(screen.queryByText("Sessões em breve")).not.toBeInTheDocument();
  });

  it("não apresenta uma pontuação nula como correspondência", () => {
    render(
      <RelatedTherapists
        matchContextActive
        source="match"
        sort="az"
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
        sort="az"
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

  it("apresenta o próximo horário no fuso de Brasília", () => {
    render(
      <RelatedTherapists
        source="directory"
        sort="next_slot"
        therapists={[
          {
            ...therapist,
            nextSlotAt: "2026-09-01T02:30:00.000Z",
          },
        ]}
        therapy={therapy}
      />,
    );

    expect(screen.getByText("31 de ago., 23:30")).toBeInTheDocument();
  });

  it("mostra até três temas publicados do guia e revela os demais", () => {
    render(
      <RelatedTherapists
        source="directory"
        sort="az"
        therapists={[
          {
            ...therapist,
            guideThemes: [
              "Autoconhecimento",
              "Espiritualidade",
              "Emoções e Bem-Estar",
              "Relacionamentos",
            ],
          },
        ]}
        therapy={therapy}
      />,
    );

    const themesSection = screen
      .getByText("Temas de atuação")
      .closest("div.rounded-md");

    expect(themesSection).not.toBeNull();
    expect(within(themesSection as HTMLElement).getByText("Autoconhecimento")).toBeVisible();
    expect(within(themesSection as HTMLElement).getByText("Espiritualidade")).toBeVisible();
    expect(within(themesSection as HTMLElement).getByText("Emoções e Bem-Estar")).toBeVisible();
    const moreThemes = within(themesSection as HTMLElement).getByRole("button", {
      name: "Ver mais 1 tema de Ana Oliveira",
    });
    expect(moreThemes).toHaveTextContent("+1");
    expect(screen.getByRole("tooltip")).toHaveClass("hidden");

    fireEvent.mouseEnter(moreThemes);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Relacionamentos");
  });

  it("oferece a ordenação alfabética sem expor mais relevantes", () => {
    render(
      <RelatedTherapists
        source="directory"
        sort="az"
        therapists={[therapist]}
        therapy={therapy}
      />,
    );

    expect(screen.getByRole("option", { name: "A–Z" })).toHaveValue("az");
    expect(
      screen.queryByRole("option", { name: "Mais relevantes" }),
    ).not.toBeInTheDocument();
  });
});
