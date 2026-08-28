import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { ReservationPage } from "./reservation-page";
import { resolveReservationContext } from "../reservation-data";

afterEach(() => {
  cleanup();
});

describe("ReservationPage", () => {
  it("renders the connected client card with a wider layout and no phone confirmation badge", () => {
    const context = resolveReservationContext({
      isPatientAuthenticated: true,
      patient: {
        avatarUrl: null,
        displayName: "Antonio Felipe",
        email: "antonio@example.com",
        phone: "+55 11 99999-9999",
        timezone: "America/Sao_Paulo",
      },
    });

    render(<ReservationPage context={context} />);

    const greeting = screen.getByText("Olá, Antonio");
    const card = greeting.closest("div");

    expect(card).not.toBeNull();
    expect(card).toHaveClass("w-full", "xl:col-span-2");
    expect(
      screen.getByText(
        "Vamos usar antonio@example.com para enviar as orientações do encontro.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Celular confirmado")).not.toBeInTheDocument();
  });
});
