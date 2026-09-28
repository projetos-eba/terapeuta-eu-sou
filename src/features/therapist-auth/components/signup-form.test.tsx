import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TherapistPlan } from "@/domain/tes";

import { TherapistSignupForm } from "./signup-form";

describe("TherapistSignupForm", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.body.style.overflow = "";
  });

  it("opens the partnership explanation before sending the signup", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        message: "Revise os campos destacados.",
        ok: false,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TherapistSignupForm plan={TherapistPlan.Free} />);

    const form = screen
      .getByRole("button", { name: "Criar minha conta" })
      .closest("form");

    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(
      await screen.findByRole("heading", {
        name: "Entenda como funciona sua parceria com o TES",
      }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    const continueButton = screen.getByRole("button", {
      name: "Entendi, continuar meu cadastro",
    });
    expect(continueButton).toBeDisabled();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Li e entendi como funciona a parceria com o TES.",
      }),
    );

    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  });
});
