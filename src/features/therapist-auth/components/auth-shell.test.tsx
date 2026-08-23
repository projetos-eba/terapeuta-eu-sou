import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TherapistPlan } from "@/domain/tes";

import { TherapistAuthShell } from "./auth-shell";
import { TherapistPlanSelection, TherapistSignupForm } from "./signup-form";

describe("therapist authentication UI", () => {
  it("uses the TES purple panel only as a larger decorative asset surface", () => {
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
    expect(
      container.querySelector('aside img[src*="therapist-login-icon"]'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Conta profissional" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Perfil privado")).not.toBeInTheDocument();
    expect(screen.queryByText("Plano seguro")).not.toBeInTheDocument();
    expect(screen.getByText(/Plano selecionado:/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar" })).toHaveClass(
      "size-11",
      "sm:w-auto",
    );
    expect(screen.getByText("Voltar")).toHaveClass("hidden", "sm:inline");
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

  it("renders a plan selection step before the therapist signup form", () => {
    render(<TherapistPlanSelection />);

    expect(
      screen.getByRole("heading", { name: "Escolha seu plano" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Selecionar Free" }),
    ).toHaveAttribute("href", "/terapeuta/cadastro?plan=free");
    expect(
      screen.getByRole("link", { name: "Selecionar Premium" }),
    ).toHaveAttribute("href", "/terapeuta/cadastro?plan=premium");
    expect(
      screen.getByRole("link", { name: "Selecionar Premium Plus" }),
    ).toHaveAttribute("href", "/terapeuta/cadastro?plan=premium_plus");
  });
});
