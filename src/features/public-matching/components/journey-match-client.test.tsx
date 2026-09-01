import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MatchingConfig } from "../types";

import {
  JourneyMatchClient,
  MATCHING_SESSION_KEY,
} from "./journey-match-client";

const config: MatchingConfig = {
  source: "supabase",
  themes: [
    {
      description: "Um tema para o teste.",
      id: "theme-1",
      imageUrl: null,
      interests: [
        {
          id: "interest-1",
          name: "Ansiedade",
          slug: "ansiedade",
          sortOrder: 1,
          themeId: "theme-1",
        },
        {
          id: "interest-2",
          name: "Estresse",
          slug: "estresse",
          sortOrder: 2,
          themeId: "theme-1",
        },
        {
          id: "interest-3",
          name: "Tristeza",
          slug: "tristeza",
          sortOrder: 3,
          themeId: "theme-1",
        },
        {
          id: "interest-4",
          name: "Medo",
          slug: "medo",
          sortOrder: 4,
          themeId: "theme-1",
        },
      ],
      name: "Autoconhecimento e Transformação",
      slug: "autoconhecimento-transformacao",
      sortOrder: 1,
    },
  ],
  version: 1,
  versionId: "version-1",
};

describe("JourneyMatchClient", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("restaura o CTA ao voltar para a jornada", () => {
    render(<JourneyMatchClient config={config} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Autoconhecimento e TransformaçãoQuestões sobre quem você é, padrões que se repetem, autoaceitação e desejo de mudança ou desenvolvimento pessoal.",
      }),
    );
    const submitButton = screen.getByRole("button", {
      name: "Ver caminhos para mim",
    });
    fireEvent.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(sessionStorage.getItem(MATCHING_SESSION_KEY)).toContain("theme-1");

    fireEvent(window, new Event("pageshow"));

    expect(submitButton).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Ver caminhos para mim" }),
    ).toBeEnabled();
  });

  it("abre os refinamentos do tema selecionado e persiste os interesses", () => {
    render(<JourneyMatchClient config={config} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /Autoconhecimento e Transform.*Questões sobre quem você é/,
      }),
    );

    expect(
      screen.getByRole("heading", { name: /Autoconhecimento e Transform/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ansiedade/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ansiedade/ }));
    fireEvent.click(screen.getByRole("button", { name: /Estresse/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tristeza/ }));

    expect(screen.getByText("3/3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Medo/ })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Ver caminhos para mim" }));

    expect(sessionStorage.getItem(MATCHING_SESSION_KEY)).toContain(
      '"interestIds":["interest-1","interest-2","interest-3"]',
    );
  });

  it("remove os refinamentos ao desmarcar o tema", () => {
    render(<JourneyMatchClient config={config} />);

    const themeButton = screen.getByRole("button", {
      name: /Autoconhecimento e Transform.*Questões sobre quem você é/,
    });
    fireEvent.click(themeButton);
    fireEvent.click(screen.getByRole("button", { name: /Ansiedade/ }));
    fireEvent.click(themeButton);

    expect(screen.queryByRole("button", { name: /Ansiedade/ })).not.toBeInTheDocument();
  });
});
