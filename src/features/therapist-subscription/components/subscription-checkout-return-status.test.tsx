import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { routes } from "@/lib/routes";

import { SubscriptionCheckoutReturnStatus } from "./subscription-checkout-return-status";

const routerMock = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

describe("SubscriptionCheckoutReturnStatus", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    routerMock.replace.mockReset();
    routerMock.refresh.mockReset();
  });

  it("redirects to the therapist area after a server-confirmed active subscription", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            checkout: {
              plan: "premium_plus",
              status: "active",
              subscriptionStatus: "active",
            },
            ok: true,
          }),
      }),
    );

    render(
      <SubscriptionCheckoutReturnStatus
        plan="premium_plus"
        sessionId="cs_test_valid_session"
      />,
    );

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith(routes.therapist.home);
    });
    expect(routerMock.refresh).toHaveBeenCalledOnce();
  });
});
