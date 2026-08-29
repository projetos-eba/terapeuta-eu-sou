import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CheckoutButton } from "./checkout-button";

const checkoutResponse = {
  checkout: {
    bookingId: "d1000000-0000-4000-8000-000000000001",
    checkoutSessionId: "cs_test_123",
    clientSecret: "checkout_client_secret",
    currency: "brl",
    discountAmountCents: 0,
    holdExpiresAt: "2026-08-29T04:40:00.000Z",
    holdId: "h1000000-0000-4000-8000-000000000001",
    originalAmountCents: 12300,
    promotion: null,
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
  it("does not abandon the reservation while checkout is reinitialized, but abandons it on exit", async () => {
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
      <CheckoutButton {...firstProps} onCheckoutChange={vi.fn()} />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === "/api/public/reservation/abandon",
      ),
    ).toHaveLength(0);

    rendered.unmount();

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(
          ([url]) => url === "/api/public/reservation/abandon",
        ),
      ).toHaveLength(1),
    );
    expect(destroy).toHaveBeenCalled();
  });
});
