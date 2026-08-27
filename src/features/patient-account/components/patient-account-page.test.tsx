import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PatientAccountPage } from "./patient-account-page";
import type { PatientAccountData } from "../patient-account.types";

const commandMocks = vi.hoisted(() => ({
  lookupPatientAddressByCep: vi.fn(),
  updatePatientAccount: vi.fn(),
  uploadPatientAvatar: vi.fn(),
  changePatientPassword: vi.fn(),
}));

vi.mock("../patient-account.commands", () => commandMocks);

describe("PatientAccountPage address", () => {
  beforeEach(() => {
    commandMocks.lookupPatientAddressByCep.mockReset();
    commandMocks.lookupPatientAddressByCep.mockResolvedValue({
      data: {
        city: "Campinas",
        neighborhood: "Morumbi",
        postalCode: "13060-240",
        state: "SP",
        street: "Rua de teste",
      },
      status: "success",
    });
    commandMocks.updatePatientAccount.mockReset();
    commandMocks.uploadPatientAvatar.mockReset();
    commandMocks.changePatientPassword.mockReset();
  });

  afterEach(() => cleanup());

  it("places CEP before the other address fields and keeps the card content bounded", () => {
    render(<PatientAccountPage data={accountFixture()} />);

    const addressSection = screen
      .getByRole("heading", { name: "Seu endereço" })
      .closest("section");
    expect(addressSection).not.toBeNull();

    const fields = Array.from(addressSection!.querySelectorAll("input")).map(
      (input) => input.id,
    );
    expect(fields).toEqual([
      "patient-postal-code",
      "patient-street",
      "patient-street-number",
      "patient-complement",
      "patient-neighborhood",
      "patient-city",
      "patient-state",
    ]);
    expect(addressSection).toHaveClass("min-w-0");
    expect(screen.getByLabelText("CEP")).toHaveAttribute(
      "autocomplete",
      "postal-code",
    );
  });

  it("looks up a complete CEP and keeps manual edits intact", async () => {
    render(<PatientAccountPage data={accountFixture()} />);

    fireEvent.change(screen.getByLabelText("CEP"), {
      target: { value: "13060240" },
    });

    await waitFor(() => {
      expect(commandMocks.lookupPatientAddressByCep).toHaveBeenCalledWith(
        "13060240",
        expect.any(AbortSignal),
      );
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Rua ou avenida")).toHaveValue(
        "Rua de teste",
      );
      expect(screen.getByLabelText("Bairro")).toHaveValue("Morumbi");
      expect(screen.getByLabelText("Cidade")).toHaveValue("Campinas");
      expect(screen.getByLabelText("UF")).toHaveValue("SP");
    });

    fireEvent.change(screen.getByLabelText("Rua ou avenida"), {
      target: { value: "Avenida preenchida manualmente" },
    });
    expect(screen.getByLabelText("Rua ou avenida")).toHaveValue(
      "Avenida preenchida manualmente",
    );
  });
});

function accountFixture(): PatientAccountData {
  return {
    account: {
      avatarUrl: null,
      email: "cliente@example.test",
      id: "c1000000-0000-4000-8000-000000000001",
      name: "Carlos",
      phone: "",
    },
    address: {
      city: "",
      complement: "",
      neighborhood: "",
      postalCode: "",
      state: "",
      street: "",
      streetNumber: "",
    },
    paymentSummary: { count: 0, totalPaidCents: 0 },
    payments: [],
    source: "demo",
  };
}
