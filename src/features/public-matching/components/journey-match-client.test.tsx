import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
      interests: [],
      name: "Autoconhecimento e Transformação",
      slug: "autoconhecimento-transformacao",
      sortOrder: 1,
    },
  ],
  version: 1,
  versionId: "version-1",
};

describe("JourneyMatchClient", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("restaura o CTA ao voltar para a jornada", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(<JourneyMatchClient config={config} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Autoconhecimento e TransformaçãoUm tema para o teste.",
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
});
