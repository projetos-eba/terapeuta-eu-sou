import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TherapistGettingStartedPage } from "./therapist-getting-started-page";
import type { TherapistHomeReadiness } from "./therapist-home-readiness.types";

describe("TherapistGettingStartedPage", () => {
  it("shows the real registration progress and its next actions", () => {
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
      screen.getByRole("heading", { name: "Complete seu cadastro" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Premium Plus/)).toBeInTheDocument();
    expect(screen.getByText("Seu progresso de cadastro")).toBeInTheDocument();
    expect(screen.getByText("Etapas do cadastro")).toBeInTheDocument();
    expect(screen.getByText("Pendências para análise")).toBeInTheDocument();
    expect(screen.getByText("Resumo do seu perfil")).toBeInTheDocument();
    expect(screen.getByText("Como funciona")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Continuar cadastro" }),
    ).toHaveAttribute("href", "/terapeuta/perfil/editar");
    expect(
      screen.getAllByText("Documento de identidade").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Comprovante de endereço").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("Cadastro ainda não enviado para análise"),
    ).toBeInTheDocument();
    expect(screen.getByText("Antonio Silva")).toBeInTheDocument();

    const settingsLinks = screen
      .getAllByRole("link")
      .filter(
        (link) => link.getAttribute("href") === "/terapeuta/configuracoes",
      );
    expect(settingsLinks).toHaveLength(4);
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
      required: true,
      state: "pending",
      title: "Conta de recebimento",
    },
  ],
  completedRequiredCount: 0,
  documents: [
    {
      complete: false,
      description: "Envie um documento oficial com foto.",
      id: "identity_document",
      state: "pending",
      title: "Documento de identidade",
    },
    {
      complete: false,
      description: "Envie um comprovante emitido nos últimos 90 dias.",
      id: "address_proof",
      state: "pending",
      title: "Comprovante de endereço",
    },
  ],
  isOperationallyReady: false,
  plan: "premium_plus",
  profileCompleteness: 17,
  profileSummary: {
    city: "",
    headline: "",
    publicName: "Antonio Silva",
    state: "",
  },
  profilePublicStatus: "draft",
  requiredCount: 6,
  therapistStatus: "draft",
  verificationStatus: "draft",
};
