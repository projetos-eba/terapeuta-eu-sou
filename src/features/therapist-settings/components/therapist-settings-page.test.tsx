import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TherapistSettingsPage } from "./therapist-settings-page";
import type { TherapistPlanPageData } from "@/features/therapist-plan/therapist-plan.types";
import type { TherapistSettingsData } from "../therapist-settings.types";

const commandMocks = vi.hoisted(() => ({
  updateTherapistSettings: vi.fn(),
}));

vi.mock("../therapist-settings.commands", () => ({
  updateTherapistSettings: commandMocks.updateTherapistSettings,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("TherapistSettingsPage", () => {
  beforeEach(() => {
    commandMocks.updateTherapistSettings.mockReset();
    commandMocks.updateTherapistSettings.mockResolvedValue({
      data: {
        account: {
          displayName: "Ana Oliveira",
          phone: "+55 11 99999-9999",
          identity: {
            city: "São Paulo",
            complement: "Apto 42",
            documentNumber: "52998224725",
            documentType: "cpf",
            neighborhood: "Pinheiros",
            postalCode: "05409-000",
            state: "SP",
            street: "Rua dos Pinheiros",
            streetNumber: "100",
          },
        },
      },
      status: "success",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders account, privacy and operational settings shortcuts", () => {
    render(
      <TherapistSettingsPage
        planData={planFixture("premium_plus")}
        settings={settingsFixture()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Configurações" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome de acesso")).toHaveValue("Ana Oliveira");
    expect(screen.getByLabelText("E-mail de acesso")).toHaveValue(
      "ana@example.test",
    );
    expect(
      screen.getByRole("link", { name: "Editar perfil público" }),
    ).toHaveAttribute("href", "/terapeuta/perfil/editar");
    expect(screen.getByRole("link", { name: "Abrir agenda" })).toHaveAttribute(
      "href",
      "/terapeuta/agenda",
    );
    expect(screen.getByRole("link", { name: "Ver plano" })).toHaveAttribute(
      "href",
      "/terapeuta/plano",
    );
    expect(
      screen.getByRole("heading", { name: "Plano e assinatura" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mudar para Premium" }),
    ).toBeInTheDocument();
  });

  it("saves edited account settings through the authenticated command", async () => {
    render(
      <TherapistSettingsPage
        planData={planFixture("premium_plus")}
        settings={settingsFixture()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Telefone"), {
      target: { value: "+55 11 99999-9999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(commandMocks.updateTherapistSettings).toHaveBeenCalledWith({
        displayName: "Ana Oliveira",
        phone: "+55 11 99999-9999",
        identity: {
          city: "São Paulo",
          complement: "Apto 42",
          documentNumber: "52998224725",
          documentType: "cpf",
          neighborhood: "Pinheiros",
          postalCode: "05409-000",
          state: "SP",
          street: "Rua dos Pinheiros",
          streetNumber: "100",
        },
      });
    });
    expect(screen.getByText("Configurações salvas.")).toBeInTheDocument();
  });

  it("shows local validation before sending invalid settings", () => {
    render(
      <TherapistSettingsPage
        planData={planFixture("premium_plus")}
        settings={settingsFixture()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Telefone"), {
      target: { value: "telefone<script>" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(commandMocks.updateTherapistSettings).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Informe um telefone válido ou deixe o campo vazio.",
    );
  });

  it("offers cancellation and the next upgrade to a Premium therapist", () => {
    const settings = settingsFixture();
    settings.profile.plan = "premium";
    render(
      <TherapistSettingsPage
        planData={planFixture("premium")}
        settings={settings}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Ver Premium Plus" }),
    ).toHaveAttribute("href", "/terapeuta/plano");
    expect(
      screen.getByRole("button", { name: "Cancelar assinatura" }),
    ).toBeInTheDocument();
  });

  it("keeps a paid plan active while cancellation is scheduled", () => {
    const planData = planFixture("premium_plus");
    if (planData.subscription) {
      planData.subscription.cancelAtPeriodEnd = true;
    }
    render(
      <TherapistSettingsPage
        planData={planData}
        settings={settingsFixture()}
      />,
    );

    expect(screen.getByText(/Cancelamento agendado para/)).toHaveTextContent(
      "Seu plano e seus benefícios continuam ativos até essa data.",
    );
    expect(
      screen.getByRole("button", { name: "Manter minha assinatura" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancelar assinatura" }),
    ).toBeNull();
  });

  it("represents a scheduled downgrade without removing current benefits", () => {
    const planData = planFixture("premium_plus");
    if (planData.subscription) {
      planData.subscription.scheduledPlan = "premium";
      planData.subscription.scheduledChangeAt = "2026-09-11T03:00:00.000Z";
    }
    render(
      <TherapistSettingsPage
        planData={planData}
        settings={settingsFixture()}
      />,
    );

    expect(
      screen.getByText(/Seu plano mudará para TES Premium/),
    ).toHaveTextContent("Até lá, seu plano atual permanece ativo.");
    expect(
      screen.queryByRole("button", { name: "Mudar para Premium" }),
    ).toBeNull();
  });

  it("explains the effective date before scheduling a downgrade", () => {
    render(
      <TherapistSettingsPage
        planData={planFixture("premium_plus")}
        settings={settingsFixture()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mudar para Premium" }));

    expect(
      screen.getByRole("dialog", { name: "Mudar para TES Premium" }),
    ).toHaveTextContent(
      "Até essa data, você continuará com todos os benefícios do TES Premium Plus.",
    );
    expect(
      screen.getByRole("button", { name: "Confirmar alteração" }),
    ).toBeInTheDocument();
  });
});

function settingsFixture(): TherapistSettingsData {
  return {
    account: {
      displayName: "Ana Oliveira",
      email: "ana@example.test",
      phone: "",
      userId: "c1000000-0000-4000-8000-000000000001",
      identity: {
        city: "São Paulo",
        complement: "Apto 42",
        documentNumber: "52998224725",
        documentType: "cpf",
        neighborhood: "Pinheiros",
        postalCode: "05409-000",
        state: "SP",
        street: "Rua dos Pinheiros",
        streetNumber: "100",
      },
    },
    profile: {
      isAcceptingBookings: false,
      isPublic: false,
      plan: "premium_plus",
      profileId: "d1000000-0000-4000-8000-000000000001",
      publicName: "Ana Oliveira",
      publicStatus: "draft",
      publicUrl: "/terapeutas/ana-oliveira",
      status: "draft",
    },
  };
}

function planFixture(
  effectivePlan: "free" | "premium" | "premium_plus",
): TherapistPlanPageData {
  return {
    catalog: [
      {
        code: "free",
        currency: "BRL",
        description: "",
        interval: null,
        name: "Free",
        unitAmountCents: 0,
      },
      {
        code: "premium",
        currency: "BRL",
        description: "",
        interval: "month",
        name: "Premium",
        unitAmountCents: 6000,
      },
      {
        code: "premium_plus",
        currency: "BRL",
        description: "",
        interval: "month",
        name: "Premium Plus",
        unitAmountCents: 12000,
      },
    ],
    effectivePlan,
    subscription:
      effectivePlan === "free"
        ? null
        : {
            cancelAtPeriodEnd: false,
            currentPeriodEnd: "2026-09-11T03:00:00.000Z",
            plan: effectivePlan,
            scheduledChangeAt: null,
            scheduledPlan: null,
            status: "active",
          },
  };
}
