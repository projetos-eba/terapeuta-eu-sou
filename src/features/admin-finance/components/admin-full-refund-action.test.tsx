import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminFullRefundAction } from "./admin-full-refund-action";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(cleanup);

describe("admin full-session refund action", () => {
  it("offers only the complete amount when the decision is available", () => {
    render(<AdminFullRefundAction paymentId="payment" amount="R$ 100,00"
      status={{ available: true, state: "available" }} />);
    expect(screen.getByRole("button", { name: "Solicitar reembolso integral" })).toBeTruthy();
    expect(screen.queryByText(/reembolso parcial/i)).toBeNull();
  });

  it("keeps a recorded decision as a follow-up instead of another refund", () => {
    render(<AdminFullRefundAction paymentId="payment" amount="R$ 100,00"
      status={{ available: false, state: "in_review",
        followup: { requestId: "request", reason: "Sessão não realizada e analisada pelo suporte." } }} />);
    expect(screen.getByRole("button", { name: "Continuar conferência" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Solicitar reembolso integral" })).toBeNull();
  });

  it("does not expose a financial action when the case is unavailable", () => {
    const { container } = render(<AdminFullRefundAction paymentId="payment" amount="R$ 100,00"
      status={{ available: false, state: "unavailable" }} />);
    expect(container.textContent).toBe("");
  });
});
