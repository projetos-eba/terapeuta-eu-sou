import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminSubscriptionCancelAction } from "./admin-subscription-cancel-action";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(cleanup);

describe("admin subscription cancellation action", () => {
  it("only offers cancellation when the subscription can be scheduled for the cycle end", () => {
    render(
      <AdminSubscriptionCancelAction
        status={{ available: true, cancelAtPeriodEnd: false }}
        subscriptionId="00000000-0000-4000-8000-000000000001"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Cancelar assinatura" }),
    ).toBeTruthy();
    expect(screen.getByText(/fim do ciclo atual/i)).toBeTruthy();
  });

  it("does not offer another cancellation after it has been scheduled", () => {
    render(
      <AdminSubscriptionCancelAction
        status={{
          available: false,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: "24/10/2026, 10:00",
        }}
        subscriptionId="00000000-0000-4000-8000-000000000001"
      />,
    );

    expect(screen.getByText(/já está programado/i)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Cancelar assinatura" }),
    ).toBeNull();
  });
});
