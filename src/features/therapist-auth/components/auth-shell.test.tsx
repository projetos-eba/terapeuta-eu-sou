import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TherapistPlan } from "@/domain/tes";

import { TherapistAuthShell } from "./auth-shell";
import { TherapistSignupForm } from "./signup-form";

describe("therapist authentication UI", () => {
  it("uses the TES purple panel and concise contextual copy", () => {
    const { container } = render(
      <TherapistAuthShell
        eyebrow="Para terapeutas"
        title="Seu espaço profissional começa aqui."
        description="Cadastre-se para acessar sua área profissional no TES."
      >
        <TherapistSignupForm plan={TherapistPlan.Free} />
      </TherapistAuthShell>,
    );

    expect(container.querySelector("aside")).toHaveClass("bg-brand-primary");
    expect(screen.getByText(/Plano selecionado:/)).toBeInTheDocument();
    expect(
      screen.queryByText(
        /Você completa perfil, documentos e dados de repasse depois/i,
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /Informações do perfil público não bloqueiam este primeiro acesso/i,
      ),
    ).not.toBeInTheDocument();
  });
});
