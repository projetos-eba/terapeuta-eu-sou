import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TherapistSettingsPage } from "./therapist-settings-page";
import type { TherapistSettingsData } from "../therapist-settings.types";

const commandMocks = vi.hoisted(() => ({
  updateTherapistSettings: vi.fn(),
}));

vi.mock("../therapist-settings.commands", () => ({
  updateTherapistSettings: commandMocks.updateTherapistSettings,
}));

describe("TherapistSettingsPage", () => {
  beforeEach(() => {
    commandMocks.updateTherapistSettings.mockReset();
    commandMocks.updateTherapistSettings.mockResolvedValue({
      data: {
        account: {
          displayName: "Ana Oliveira",
          phone: "+55 11 99999-9999",
        },
      },
      status: "success",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders account, privacy and operational settings shortcuts", () => {
    render(<TherapistSettingsPage settings={settingsFixture()} />);

    expect(
      screen.getByRole("heading", { name: "Configurações" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome de uso interno")).toHaveValue(
      "Ana Oliveira",
    );
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
  });

  it("saves edited account settings through the authenticated command", async () => {
    render(<TherapistSettingsPage settings={settingsFixture()} />);

    fireEvent.change(screen.getByLabelText("Telefone"), {
      target: { value: "+55 11 99999-9999" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    await waitFor(() => {
      expect(commandMocks.updateTherapistSettings).toHaveBeenCalledWith({
        displayName: "Ana Oliveira",
        phone: "+55 11 99999-9999",
      });
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Configurações salvas.",
    );
  });

  it("shows local validation before sending invalid settings", () => {
    render(<TherapistSettingsPage settings={settingsFixture()}/>);

    fireEvent.change(screen.getByLabelText("Telefone"), {
      target: { value: "telefone<script>" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    expect(commandMocks.updateTherapistSettings).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Informe um telefone válido ou deixe o campo vazio.",
    );
  });
});

function settingsFixture(): TherapistSettingsData {
  return {
    account: {
      displayName: "Ana Oliveira",
      email: "ana@example.test",
      phone: "",
      userId: "c1000000-0000-4000-8000-000000000001",
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
