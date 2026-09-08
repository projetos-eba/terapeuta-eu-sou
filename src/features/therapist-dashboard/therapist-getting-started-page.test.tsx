import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TherapistGettingStartedPage } from "./therapist-getting-started-page";
import type { TherapistHomeReadiness } from "./therapist-home-readiness.types";

describe("TherapistGettingStartedPage", () => {
  afterEach(cleanup);

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
    expect(screen.getByText("Pendências do cadastro")).toBeInTheDocument();
    expect(screen.getByText("Resumo do seu perfil")).toBeInTheDocument();
    expect(screen.queryByText("Apresentação", { exact: true })).toBeNull();
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

  it("keeps the checklist visible when the completed profile awaits approval", () => {
    const readiness: TherapistHomeReadiness = {
      ...readinessFixture,
      checklist: readinessFixture.checklist.map((item) => ({
        ...item,
        complete: true,
        state: item.id === "profile" ? "in_review" : "complete",
      })),
      completedRequiredCount: 6,
      documents: readinessFixture.documents.map((item) => ({
        ...item,
        complete: true,
        state: "complete",
      })),
      isOperationallyReady: true,
      profilePublicStatus: "unpublished",
      therapistStatus: "submitted",
      verificationStatus: "submitted",
    };

    render(
      <TherapistGettingStartedPage
        readiness={readiness}
        session={{
          name: "Antonio Silva",
          plan: "premium_plus",
          status: "submitted",
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Complete seu cadastro" }),
    ).toBeInTheDocument();
    expect(screen.getByText("6 de 6 concluídas")).toBeInTheDocument();
    expect(
      screen.getByText("Cadastro enviado para análise"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Seu cadastro está completo. O TES está analisando e logo você terá um retorno.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Seus itens obrigatórios foram concluídos. Acompanhe a situação do cadastro.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the receiving account as the real pending item after documents are sent", () => {
    const readiness: TherapistHomeReadiness = {
      ...readinessFixture,
      checklist: readinessFixture.checklist.map((item) => ({
        ...item,
        complete: item.id !== "connect",
        description:
          item.id === "connect"
            ? "Conecte sua conta de recebimento para preparar os repasses das sessões."
            : item.description,
        state: item.id === "connect" ? "pending" : "complete",
      })),
      completedRequiredCount: 5,
      documents: readinessFixture.documents.map((item) => ({
        ...item,
        complete: true,
        state: "complete",
      })),
      isOperationallyReady: false,
      profilePublicStatus: "published",
      therapistStatus: "draft",
    };

    render(
      <TherapistGettingStartedPage
        readiness={readiness}
        session={{
          name: "Antonio Silva",
          plan: "premium_plus",
          status: "draft",
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Pendências do cadastro" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Falta concluir: Conta de recebimento."),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Conecte sua conta de recebimento para preparar os repasses das sessões.",
      ),
    ).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "Conectar conta" }),
    ).toHaveAttribute("href", "/terapeuta/financeiro?tab=conta");
    expect(
      screen.queryByText(
        "Seus documentos obrigatórios foram enviados. Acompanhe o andamento da análise na situação ao lado.",
      ),
    ).toBeNull();
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
    publicName: "Antonio Silva",
    state: "",
  },
  profilePublicStatus: "draft",
  requiredCount: 6,
  therapistStatus: "draft",
  verificationStatus: "draft",
};
