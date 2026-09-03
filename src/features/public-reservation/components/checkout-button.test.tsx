import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CheckoutButton } from "./checkout-button";

const checkoutResponse = {
  checkout: {
    bookingId: "d1000000-0000-4000-8000-000000000001",
    checkoutSessionId: "cs_test_123",
    clientSecret: "checkout_client_secret",
    currency: "brl",
    discountAmountCents: 0,
    holdExpiresAt: "2099-08-29T04:40:00.000Z",
    holdId: "h1000000-0000-4000-8000-000000000001",
    mode: "initial_hold" as const,
    originalAmountCents: 12300,
    promotion: null,
    reservationExpiresAt: "2099-08-29T04:40:00.000Z",
    serverNow: new Date().toISOString(),
    sessionPaymentId: "p1000000-0000-4000-8000-000000000001",
    totalAmountCents: 12300,
  },
  ok: true as const,
};

function props(
  overrides: Partial<React.ComponentProps<typeof CheckoutButton>> = {},
) {
  return {
    acceptedTerms: true,
    isPatientAuthenticated: true,
    loginHref: "/entrar",
    onCheckoutChange: vi.fn(),
    onPromotionSettled: vi.fn(),
    serviceId: "s1000000-0000-4000-8000-000000000001",
    sharedNote: "",
    startsAt: "2026-08-29T04:30:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  window.Stripe = undefined;
});

describe("CheckoutButton", () => {
  it("does not mount a late Stripe instance after the reservation expires", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_public");
    const mount = vi.fn();
    const destroy = vi.fn();
    let finishInitialization!: (checkout: {
      mount: typeof mount;
      destroy: typeof destroy;
    }) => void;
    const initEmbeddedCheckout = vi.fn(
      () =>
        new Promise<{ mount: typeof mount; destroy: typeof destroy }>(
          (resolve) => {
            finishInitialization = resolve;
          },
        ),
    );
    window.Stripe = vi.fn(() => ({ initEmbeddedCheckout }));
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        ...checkoutResponse,
        checkout: {
          ...checkoutResponse.checkout,
          reservationExpiresAt: new Date(Date.now() - 1_000).toISOString(),
          serverNow: new Date().toISOString(),
        },
      }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);
    const onCheckoutChange = vi.fn();
    render(<CheckoutButton {...props({ onCheckoutChange })} />);
    await waitFor(() =>
      expect(
        screen.getByText("O prazo de exclusividade de 5 minutos terminou."),
      ).toBeInTheDocument(),
    );
    await act(async () => finishInitialization({ mount, destroy }));

    expect(mount).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledOnce();
    expect(onCheckoutChange.mock.calls.some(([value]) => value.ready)).toBe(
      false,
    );
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === "/api/public/reservation/abandon",
      ),
    ).toHaveLength(1);
  });

  it("opens a payment retry without a countdown or a new slot payload", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_public");
    const mount = vi.fn();
    window.Stripe = vi.fn(() => ({
      initEmbeddedCheckout: vi
        .fn()
        .mockResolvedValue({ destroy: vi.fn(), mount }),
    }));
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        ...checkoutResponse,
        checkout: {
          ...checkoutResponse.checkout,
          mode: "payment_retry",
          reservationExpiresAt: null,
        },
      }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const bookingId = "d1000000-0000-4000-8000-000000000099";
    render(
      <CheckoutButton
        {...props({
          retryBookingId: bookingId,
          serviceId: null,
          startsAt: null,
        })}
      />,
    );
    await waitFor(() => expect(mount).toHaveBeenCalledOnce());

    const request = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(request).toMatchObject({ action: "retry", bookingId });
    expect(request).not.toHaveProperty("serviceId");
    expect(document.body).not.toHaveTextContent("Seu horário está reservado");
    expect(document.body).not.toHaveTextContent(
      "Você pode concluir o pagamento, mas o horário não fica reservado",
    );
  });

  it("reports a patient schedule conflict before mounting Stripe", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_public");
    const mount = vi.fn();
    window.Stripe = vi.fn(() => ({
      initEmbeddedCheckout: vi
        .fn()
        .mockResolvedValue({ destroy: vi.fn(), mount }),
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          code: "PATIENT_SCHEDULE_CONFLICT",
          message: "Você já tem um encontro nesse horário.",
          ok: false,
        }),
        ok: false,
      }),
    );
    const onPatientScheduleConflict = vi.fn();

    render(<CheckoutButton {...props({ onPatientScheduleConflict })} />);

    await waitFor(() =>
      expect(onPatientScheduleConflict).toHaveBeenCalledOnce(),
    );
    expect(mount).not.toHaveBeenCalled();
  });

  it("reuses the checkout attempt after an internal reservation transition", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_public");

    const mount = vi.fn();
    window.Stripe = vi.fn(() => ({
      initEmbeddedCheckout: vi
        .fn()
        .mockResolvedValue({ destroy: vi.fn(), mount }),
    }));
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => checkoutResponse,
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const checkoutAttemptId = "a1000000-0000-4000-8000-000000000001";
    const first = render(<CheckoutButton {...props({ checkoutAttemptId })} />);
    await waitFor(() => expect(mount).toHaveBeenCalledOnce());
    first.unmount();

    render(<CheckoutButton {...props({ checkoutAttemptId })} />);
    await waitFor(() => expect(mount).toHaveBeenCalledTimes(2));

    const checkoutAttempts = fetchMock.mock.calls
      .filter(([url]) => url === "/api/public/reservation/checkout")
      .map(([, init]) => JSON.parse(init?.body as string).checkoutAttemptId);
    expect(checkoutAttempts).toEqual([checkoutAttemptId, checkoutAttemptId]);
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === "/api/public/reservation/abandon",
      ),
    ).toHaveLength(0);
  });

  it("does not treat pagehide as abandonment because it also fires during refresh", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_public");
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: undefined,
    });

    const mount = vi.fn();
    const destroy = vi.fn();
    window.Stripe = vi.fn(() => ({
      initEmbeddedCheckout: vi.fn().mockResolvedValue({ destroy, mount }),
    }));
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => checkoutResponse,
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const firstProps = props();
    const rendered = render(<CheckoutButton {...firstProps} />);

    await waitFor(() => expect(mount).toHaveBeenCalledOnce());
    rendered.rerender(
      <CheckoutButton
        {...firstProps}
        promotionRequest={{
          code: "PROMO100",
          requestId: "a1000000-0000-4000-8000-000000000001",
        }}
      />,
    );

    window.dispatchEvent(new Event("pagehide"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === "/api/public/reservation/abandon",
      ),
    ).toHaveLength(0);

    window.dispatchEvent(new Event("pagehide"));
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === "/api/public/reservation/abandon",
      ),
    ).toHaveLength(0);
    rendered.unmount();
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === "/api/public/reservation/abandon",
      ),
    ).toHaveLength(0);
    expect(destroy).toHaveBeenCalled();
  });

  it("does not recreate Stripe when the parent rerenders after checkout readiness", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_public");
    const mount = vi.fn();
    const destroy = vi.fn();
    const initEmbeddedCheckout = vi.fn().mockResolvedValue({ destroy, mount });
    window.Stripe = vi.fn(() => ({ initEmbeddedCheckout }));
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => checkoutResponse,
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const stableProps = props();
    const rendered = render(<CheckoutButton {...stableProps} />);
    await waitFor(() => expect(mount).toHaveBeenCalledOnce());

    rendered.rerender(<CheckoutButton {...stableProps} />);

    expect(initEmbeddedCheckout).toHaveBeenCalledOnce();
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === "/api/public/reservation/checkout",
      ),
    ).toHaveLength(1);
    expect(destroy).not.toHaveBeenCalled();
  });
});
