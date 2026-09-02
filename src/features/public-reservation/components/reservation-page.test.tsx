import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { ReservationPage } from "./reservation-page";
import {
  applyPatientScheduleConflicts,
  resolveReservationContext,
} from "../reservation-data";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/reserva");
});

describe("ReservationPage", () => {
  it("does not show a reservation countdown before checkout", () => {
    const context = resolveReservationContext({
      isPatientAuthenticated: true,
    });
    render(<ReservationPage context={context} />);

    expect(screen.queryByText(/Reserva por/i)).not.toBeInTheDocument();
  });

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

  it("explains hidden patient conflicts and blocks a stale direct URL", () => {
    const base = resolveReservationContext({
      isPatientAuthenticated: true,
      searchParams: {
        duration: "50",
        etapa: "pagamento",
        slot: "2026-08-29T21:30:00.000Z",
      },
    });
    const { context } = applyPatientScheduleConflicts({
      availabilityDays: [
        {
          date: "2026-08-29",
          dateLabel: "29/08",
          dayLabel: "Amanhã",
          slots: [
            {
              dateLabel: "29/08",
              dayLabel: "Amanhã",
              endsAt: "2026-08-29T22:20:00.000Z",
              serviceId: "d1000000-0000-4000-8000-000000000001",
              startsAt: "2026-08-29T21:30:00.000Z",
              timeLabel: "18:30",
            },
          ],
        },
      ],
      context: base,
      intervals: [
        {
          endsAt: "2026-08-29T22:20:00.000Z",
          startsAt: "2026-08-29T21:30:00.000Z",
        },
      ],
    });

    render(<ReservationPage context={context} />);

    expect(
      screen.getByText(
        "Horários que coincidem com seus encontros atuais não são exibidos.",
      ),
    ).toBeInTheDocument();
    expect(
      screen
        .getByText(
          "Você já tem outro encontro nesse horário. Escolha outro momento.",
        )
        .closest('[role="alert"]'),
    ).not.toBeNull();
    expect(screen.queryByText("Confirme sua reserva")).toBeInTheDocument();
  });

  it("shows an honest message when the personalized comparison is unavailable", () => {
    const context = resolveReservationContext({
      isPatientAuthenticated: true,
    });

    render(<ReservationPage context={context} />);

    expect(
      screen.getByText(
        "Não conseguimos comparar estes horários com seus outros encontros agora. A confirmação será feita antes do pagamento.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps the accepted terms and checkout attempt when returning to preparation", () => {
    const context = resolveReservationContext({
      isPatientAuthenticated: true,
      searchParams: {
        etapa: "preparar",
        service: "d1000000-0000-4000-8000-000000000001",
        slot: "2026-09-01T16:15:00.000Z",
      },
    });

    render(<ReservationPage context={context} />);

    fireEvent.click(screen.getByRole("checkbox", { name: /aceito os/i }));
    fireEvent.click(
      screen
        .getAllByRole("button", { name: /avan/i })
        .find((button) => button.getAttribute("type") === "submit")!,
    );

    expect(
      screen.getByRole("heading", { name: /confirme seus dados/i }),
    ).toBeInTheDocument();

    window.history.replaceState(
      window.history.state,
      "",
      "/reserva?etapa=preparar",
    );
    fireEvent.popState(window);

    const advanceButton = screen
      .getAllByRole("button", { name: /avan/i })
      .find((button) => button.getAttribute("type") === "submit");

    expect(advanceButton).toBeDefined();
    expect(advanceButton).toBeEnabled();
  });

  it("opens support in the checkout and removes the redundant payment anchor", () => {
    const context = resolveReservationContext({
      isPatientAuthenticated: true,
      searchParams: {
        etapa: "preparar",
        service: "d1000000-0000-4000-8000-000000000001",
        slot: "2026-09-01T16:15:00.000Z",
      },
    });

    render(<ReservationPage context={context} />);

    fireEvent.click(screen.getByRole("checkbox", { name: /aceito os/i }));
    fireEvent.click(
      screen
        .getAllByRole("button", { name: /avan/i })
        .find((button) => button.getAttribute("type") === "submit")!,
    );

    const support = screen.getByRole("heading", { name: "Precisa de ajuda?" });
    const policy = screen.getByRole("heading", { name: /Pol/ });
    expect(
      support.compareDocumentPosition(policy) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fale conosco" }));
    expect(
      screen.getByRole("dialog", { name: "Novo chamado" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Categoria")).toHaveValue("outro");
    expect(screen.getByLabelText("Assunto")).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Novo chamado" }).querySelector("textarea"),
    ).not.toBeNull();
    expect(
      screen.queryByRole("link", { name: "Ir para pagamento seguro" }),
    ).toBeNull();
  });
});
