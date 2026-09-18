import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionChargeRecoveryCard } from "./session-charge-recovery-card";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

const bookingId = "a0000000-0000-4000-8000-000000000301";

describe("SessionChargeRecoveryCard", () => {
  beforeEach(() => {
    mocks.refresh.mockReset();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    (window as unknown as { Stripe?: unknown }).Stripe = undefined;
  });

  it("opens and confirms the same PaymentIntent without starting a new checkout", async () => {
    const mount = vi.fn();
    const destroy = vi.fn();
    const confirmPayment = vi.fn().mockResolvedValue({
      paymentIntent: { status: "succeeded" },
    });
    const submit = vi.fn().mockResolvedValue({});
    const elements = {
      create: vi.fn(() => ({ destroy, mount })),
      submit,
    };
    (window as unknown as { Stripe?: unknown }).Stripe = vi.fn(() => ({
      confirmPayment,
      elements: vi.fn(() => elements),
    }));
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            clientSecret: "pi_bound_secret_test",
            status: "requires_action",
          },
          ok: true,
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SessionChargeRecoveryCard
        bookingId={bookingId}
        stripePublishableKey="pk_test_public"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Concluir pagamento" }));

    await waitFor(() => expect(mount).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/patient/session-charge-recovery",
      expect.objectContaining({
        body: JSON.stringify({ bookingId }),
        method: "POST",
      }),
    );
    expect(
      screen.queryByText(/SetupIntent|PaymentIntent|arquitetura/i),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar pagamento" }),
    );
    await waitFor(() => expect(confirmPayment).toHaveBeenCalledOnce());
    expect(submit).toHaveBeenCalledOnce();
    expect(submit.mock.invocationCallOrder[0]).toBeLessThan(
      confirmPayment.mock.invocationCallOrder[0],
    );
    expect(confirmPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        clientSecret: "pi_bound_secret_test",
        elements,
        redirect: "if_required",
      }),
    );
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  });

  it("keeps the room recovery actionable after a declined confirmation", async () => {
    (window as unknown as { Stripe?: unknown }).Stripe = vi.fn(() => ({
      confirmPayment: vi.fn().mockResolvedValue({
        error: { message: "O cartão foi recusado." },
      }),
      elements: vi.fn(() => ({
        create: () => ({ destroy: vi.fn(), mount: vi.fn() }),
        submit: vi.fn().mockResolvedValue({}),
      })),
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { clientSecret: "pi_bound_secret_test" },
            ok: true,
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      ),
    );
    render(
      <SessionChargeRecoveryCard
        bookingId={bookingId}
        stripePublishableKey="pk_test_public"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Concluir pagamento" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Confirmar pagamento" }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar pagamento" }),
    );
    expect(
      await screen.findByText("O cartão foi recusado."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirmar pagamento" }),
    ).toBeEnabled();
  });

  it("does not confirm an invalid form and lets the patient correct it", async () => {
    const confirmPayment = vi.fn();
    (window as unknown as { Stripe?: unknown }).Stripe = vi.fn(() => ({
      confirmPayment,
      elements: vi.fn(() => ({
        create: () => ({ destroy: vi.fn(), mount: vi.fn() }),
        submit: vi.fn().mockResolvedValue({
          error: { message: "Confira o número do cartão." },
        }),
      })),
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ data: { clientSecret: "pi_bound_secret_test" } }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      ),
    );
    render(
      <SessionChargeRecoveryCard
        bookingId={bookingId}
        stripePublishableKey="pk_test_public"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Concluir pagamento" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Confirmar pagamento" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar pagamento" }));
    expect(await screen.findByText("Confira o número do cartão.")).toBeInTheDocument();
    expect(confirmPayment).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirmar pagamento" })).toBeEnabled();
  });

  it("recovers from an unexpected Stripe failure without leaving the button stuck", async () => {
    (window as unknown as { Stripe?: unknown }).Stripe = vi.fn(() => ({
      confirmPayment: vi.fn().mockRejectedValue(new Error("integration_error")),
      elements: vi.fn(() => ({
        create: () => ({ destroy: vi.fn(), mount: vi.fn() }),
        submit: vi.fn().mockResolvedValue({}),
      })),
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ data: { clientSecret: "pi_bound_secret_test" } }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      ),
    );
    render(
      <SessionChargeRecoveryCard
        bookingId={bookingId}
        stripePublishableKey="pk_test_public"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Concluir pagamento" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Confirmar pagamento" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar pagamento" }));
    expect(
      await screen.findByText("Não foi possível concluir o pagamento agora. Tente novamente em instantes."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar pagamento" })).toBeEnabled();
  });
});
