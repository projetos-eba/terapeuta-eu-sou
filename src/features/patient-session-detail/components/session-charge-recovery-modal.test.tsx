import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { SessionChargeRecoveryModal } from "./session-charge-recovery-modal";

afterEach(cleanup);

describe("SessionChargeRecoveryModal", () => {
  it("keeps the payment form out of the encounter detail until opened", () => {
    render(
      <SessionChargeRecoveryModal
        bookingId="a0000000-0000-4000-8000-000000000301"
        stripePublishableKey="pk_test_public"
      />,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Concluir pagamento" }));
    expect(screen.getByRole("dialog", { name: "Concluir pagamento" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar pagamento" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
