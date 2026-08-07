import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TherapistGettingStartedPage } from "./therapist-getting-started-page";

describe("TherapistGettingStartedPage", () => {
  it("gives a new paid therapist operational first steps", () => {
    render(
      <TherapistGettingStartedPage
        session={{
          name: "Antonio Silva",
          plan: "premium_plus",
          status: "draft",
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Olá, Antonio." }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Premium Plus").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: "Abrir perfil" }),
    ).toHaveAttribute("href", "/terapeuta/perfil");
    expect(
      screen.getByRole("link", { name: "Gerenciar terapias" }),
    ).toHaveAttribute("href", "/terapeuta/servicos");
    expect(screen.getByRole("link", { name: "Abrir agenda" })).toHaveAttribute(
      "href",
      "/terapeuta/agenda",
    );
    expect(
      screen.getByRole("link", { name: "Ver financeiro" }),
    ).toHaveAttribute("href", "/terapeuta/financeiro?tab=conta");
    expect(screen.getByText("Em rascunho")).toBeInTheDocument();
  });
});
