import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TherapistGettingStartedPage } from "./therapist-getting-started-page";
import type { TherapistHomeReadiness } from "./therapist-home-readiness.types";

describe("TherapistGettingStartedPage", () => {
  it("gives a new paid therapist operational first steps", () => {
    render(
      <TherapistGettingStartedPage
        readiness={readinessFixture}
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
      screen.getByRole("heading", { name: "Checklist de primeiros passos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Publicar perfil" }),
    ).toHaveAttribute("href", "/terapeuta/perfil/editar");
    expect(
      screen.getByRole("link", { name: "Gerenciar terapias" }),
    ).toHaveAttribute("href", "/terapeuta/servicos");
    expect(screen.getByRole("link", { name: "Abrir agenda" })).toHaveAttribute(
      "href",
      "/terapeuta/agenda",
    );
    expect(
      screen.getByRole("link", { name: "Conectar conta" }),
    ).toHaveAttribute("href", "/terapeuta/financeiro?tab=conta");
    expect(screen.getByText("0 de 3 concluídos")).toBeInTheDocument();
    expect(screen.getByText("Recomendado")).toBeInTheDocument();
    expect(screen.getByText("Em rascunho")).toBeInTheDocument();
  });
});

const readinessFixture: TherapistHomeReadiness = {
  checklist: [
    {
      actionLabel: "Publicar perfil",
      complete: false,
      description: "Publique sua apresentação pública.",
      href: "/terapeuta/perfil/editar",
      id: "profile",
      required: true,
      state: "pending",
      title: "Perfil público",
    },
    {
      actionLabel: "Gerenciar terapias",
      complete: false,
      description: "Cadastre ao menos uma terapia ativa.",
      href: "/terapeuta/servicos",
      id: "services",
      required: true,
      state: "pending",
      title: "Terapias ativas",
    },
    {
      actionLabel: "Abrir agenda",
      complete: false,
      description: "Configure horários recorrentes.",
      href: "/terapeuta/agenda",
      id: "agenda",
      required: true,
      state: "pending",
      title: "Agenda disponível",
    },
    {
      actionLabel: "Conectar conta",
      complete: false,
      description: "Prepare os repasses.",
      href: "/terapeuta/financeiro?tab=conta",
      id: "connect",
      required: false,
      state: "pending",
      title: "Conta de recebimento",
    },
  ],
  completedRequiredCount: 0,
  isOperationallyReady: false,
  plan: "premium_plus",
  profileCompleteness: 17,
  profilePublicStatus: "draft",
  requiredCount: 3,
  therapistStatus: "draft",
};
