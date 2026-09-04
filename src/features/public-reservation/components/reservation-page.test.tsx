import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { ReservationPage, ReservationSuccessPage } from "./reservation-page";
import {
  applyPatientScheduleConflicts,
  resolveReservationContext,
} from "../reservation-data";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  window.Stripe = undefined;
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/reserva");
});

describe("ReservationPage", () => {
  it.each(["malformed", "unknown"])(
    "recovers status polling after a %s response without inventing failure",
    async (kind) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => {
              if (kind === "malformed") throw new SyntaxError("Invalid JSON");
              return { status: "unexpected" };
            },
          })
          .mockResolvedValue({
            ok: true,
            json: async () => ({ status: "confirmed" }),
          }),
      );
      render(<ReservationSuccessPage />);
      expect(
        await screen.findByRole(
          "heading",
          { name: "Seu encontro está confirmado" },
          { timeout: 3500 },
        ),
      ).toBeInTheDocument();
    },
  );

  it("aborts an in-flight status request on unmount", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, options) => {
        signal = options.signal;
        return new Promise(() => {});
      }),
    );
    const view = render(<ReservationSuccessPage />);
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it.each([
    [401, "Entre para acompanhar o pagamento"],
    [404, "Confira a situação do pagamento"],
  ])(
    "does not report a failed payment when status lookup returns %s",
    async (status, heading) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status }));
      render(<ReservationSuccessPage />);
      expect(
        await screen.findByRole("heading", { name: heading }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Nenhuma confirmação foi registrada.", {
          exact: false,
        }),
      ).not.toBeInTheDocument();
    },
  );

  it("keeps Stripe mounted when checkout readiness and support rerender the page", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_public");
    const mount = vi.fn();
    const destroy = vi.fn();
    const initEmbeddedCheckout = vi.fn().mockResolvedValue({ destroy, mount });
    window.Stripe = vi.fn(() => ({ initEmbeddedCheckout }));
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        ok: true,
        checkout: {
          bookingId: "d1000000-0000-4000-8000-000000000001",
          checkoutSessionId: "cs_test_stable",
          clientSecret: "test_client_secret",
          currency: "brl",
          discountAmountCents: 0,
          mode: "initial_hold",
          originalAmountCents: 12000,
          promotion: null,
          reservationExpiresAt: new Date(Date.now() + 300_000).toISOString(),
          serverNow: new Date().toISOString(),
          totalAmountCents: 12000,
        },
      }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);
    const context = resolveReservationContext({
      isPatientAuthenticated: true,
      searchParams: {
        etapa: "preparar",
        service: "d1000000-0000-4000-8000-000000000001",
        slot: "2026-09-09T14:00:00.000Z",
      },
    });
    render(<ReservationPage context={context} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /aceito os/i }));
    fireEvent.click(
      screen
        .getAllByRole("button", { name: /avan/i })
        .find((button) => button.getAttribute("type") === "submit")!,
    );
    await waitFor(() => expect(mount).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: "Fale conosco" }));
    expect(
      screen.getByRole("dialog", { name: "Novo chamado" }),
    ).toBeInTheDocument();
    expect(initEmbeddedCheckout).toHaveBeenCalledOnce();
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === "/api/public/reservation/checkout",
      ),
    ).toHaveLength(1);
    expect(destroy).not.toHaveBeenCalled();
  });

  it("does not show a reservation countdown before checkout", () => {
    const context = resolveReservationContext({
      isPatientAuthenticated: true,
    });
    render(<ReservationPage context={context} />);

    expect(screen.queryByText(/Reserva por/i)).not.toBeInTheDocument();
  });

  it("labels the agenda navigation as five-day jumps", () => {
    const context = resolveReservationContext({
      isPatientAuthenticated: false,
    });

    render(<ReservationPage context={context} />);

    expect(screen.getByText("5 dias anteriores")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "5 dias seguintes" }),
    ).toBeInTheDocument();
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

  it("keeps patient conflicts visible and blocks a stale direct URL with a dialog", () => {
    const base = resolveReservationContext({
      isPatientAuthenticated: true,
      searchParams: {
        duration: "50",
        etapa: "pagamento",
        slot: "2026-09-03T21:30:00.000Z",
      },
    });
    const result = applyPatientScheduleConflicts({
      availabilityDays: [
        {
          date: "2026-09-03",
          dateLabel: "03/09",
          dayLabel: "Amanhã",
          slots: [
            {
              dateLabel: "03/09",
              dayLabel: "Amanhã",
              endsAt: "2026-09-03T22:20:00.000Z",
              serviceId: "d1000000-0000-4000-8000-000000000001",
              startsAt: "2026-09-03T21:30:00.000Z",
              timeLabel: "18:30",
            },
          ],
        },
      ],
      context: base,
      intervals: [
        {
          endsAt: "2026-09-03T22:20:00.000Z",
          startsAt: "2026-09-03T21:30:00.000Z",
        },
      ],
    });

    render(
      <ReservationPage
        availabilityDays={result.availabilityDays}
        context={result.context}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "18:30, coincide com outro encontro seu",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", {
        name: "Você já tem um encontro nesse horário",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Para evitar dois atendimentos ao mesmo tempo, escolha outro horário disponível.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver meus encontros" }),
    ).toHaveAttribute("href", "/app/encontros");
    expect(
      screen.getByRole("heading", { name: "Escolha o seu melhor momento" }),
    ).toBeInTheDocument();
  });

  it("opens the conflict dialog without navigating while a consecutive slot remains selectable", () => {
    const result = applyPatientScheduleConflicts({
      availabilityDays: [
        {
          date: "2026-09-03",
          dateLabel: "03/09",
          dayLabel: "Amanhã",
          slots: [
            {
              dateLabel: "03/09",
              dayLabel: "Amanhã",
              endsAt: "2026-09-03T22:20:00.000Z",
              serviceId: "d1000000-0000-4000-8000-000000000001",
              startsAt: "2026-09-03T21:30:00.000Z",
              timeLabel: "18:30",
            },
            {
              dateLabel: "03/09",
              dayLabel: "Amanhã",
              endsAt: "2026-09-03T23:10:00.000Z",
              serviceId: "d1000000-0000-4000-8000-000000000001",
              startsAt: "2026-09-03T22:20:00.000Z",
              timeLabel: "19:20",
            },
          ],
        },
      ],
      context: resolveReservationContext({ isPatientAuthenticated: true }),
      intervals: [
        {
          endsAt: "2026-09-03T22:20:00.000Z",
          startsAt: "2026-09-03T21:30:00.000Z",
        },
      ],
    });
    render(
      <ReservationPage
        availabilityDays={result.availabilityDays}
        context={result.context}
      />,
    );
    const pathBeforeClick = window.location.href;

    fireEvent.click(
      screen.getByRole("button", {
        name: "18:30, coincide com outro encontro seu",
      }),
    );

    expect(window.location.href).toBe(pathBeforeClick);
    expect(
      screen.getByRole("dialog", {
        name: "Você já tem um encontro nesse horário",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "19:20" })).toBeInTheDocument();
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

  it("restores the checkout journey after a browser refresh", async () => {
    const serviceId = "d1000000-0000-4000-8000-000000000001";
    const slot = "2026-09-01T16:15:00.000Z";
    const checkoutAttemptId = "a1000000-0000-4000-8000-000000000001";
    const reservationKey = `${serviceId}:${slot}`;
    window.history.replaceState(
      {
        "tes.reservation.journey-draft.v1": {
          acceptedTerms: true,
          checkoutAttemptId,
          marketingConsent: false,
          reservationKey,
        },
      },
      "",
      `/reserva?etapa=pagamento&service=${serviceId}&slot=${encodeURIComponent(slot)}`,
    );
    const context = resolveReservationContext({
      isPatientAuthenticated: true,
      searchParams: {
        etapa: "pagamento",
        service: serviceId,
        slot,
      },
    });

    render(<ReservationPage context={context} />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /confirme seus dados/i }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByText("Aceite os termos antes de seguir para o pagamento."),
    ).not.toBeInTheDocument();
    expect(
      window.history.state["tes.reservation.journey-draft.v1"],
    ).toMatchObject({
      acceptedTerms: true,
      checkoutAttemptId,
      reservationKey,
    });
  });

  it("restores the checkout journey from tab storage when Next replaces history state", async () => {
    const serviceId = "d1000000-0000-4000-8000-000000000001";
    const slot = "2026-09-01T16:15:00.000Z";
    const checkoutAttemptId = "a1000000-0000-4000-8000-000000000002";
    const reservationKey = `${serviceId}:${slot}`;
    window.sessionStorage.setItem(
      "tes.reservation.journey-draft.v1",
      JSON.stringify({
        acceptedTerms: true,
        checkoutAttemptId,
        marketingConsent: false,
        reservationKey,
      }),
    );
    window.history.replaceState(
      {},
      "",
      `/reserva?etapa=pagamento&service=${serviceId}&slot=${encodeURIComponent(slot)}`,
    );

    render(
      <ReservationPage
        context={resolveReservationContext({
          isPatientAuthenticated: true,
          searchParams: { etapa: "pagamento", service: serviceId, slot },
        })}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: /confirme seus dados/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Aceite os termos antes de seguir para o pagamento."),
    ).not.toBeInTheDocument();
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
      screen
        .getByRole("dialog", { name: "Novo chamado" })
        .querySelector("textarea"),
    ).not.toBeNull();
    expect(
      screen.queryByRole("link", { name: "Ir para pagamento seguro" }),
    ).toBeNull();
  });
});
