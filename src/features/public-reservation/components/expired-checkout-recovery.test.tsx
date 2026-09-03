import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExpiredCheckoutRecovery } from "./expired-checkout-recovery";

const bookingId = "d1000000-0000-4000-8000-000000000001";
const checkoutSessionId = "cs_test_expired";

function response(released: boolean) {
  return { ok: true, json: async () => ({ ok: true, data: { released } }) };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ExpiredCheckoutRecovery", () => {
  it("offers the authenticated booking retry only after release, without creating a hold", async () => {
    let finishRelease!: (result: ReturnType<typeof response>) => void;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<ReturnType<typeof response>>((resolve) => {
          finishRelease = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ExpiredCheckoutRecovery
        bookingId={bookingId}
        checkoutSessionId={checkoutSessionId}
      />,
    );
    expect(
      screen.queryByRole("link", { name: "Continuar pagamento" }),
    ).not.toBeInTheDocument();
    finishRelease(response(true));

    const continueLink = await screen.findByRole("link", {
      name: "Continuar pagamento",
    });
    expect(continueLink).toHaveAttribute(
      "href",
      `/reserva?booking=${bookingId}&etapa=pagamento`,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "O horário não fica mais reservado",
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/public/reservation/abandon");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      bookingId,
      checkoutSessionId,
      reason: "reservation_expired",
    });
  });

  it("does not start a retry when payment or another tab won the race", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(false)));
    render(
      <ExpiredCheckoutRecovery
        bookingId={bookingId}
        checkoutSessionId={checkoutSessionId}
      />,
    );

    expect(
      await screen.findByRole("link", { name: "Acompanhar pagamento" }),
    ).toHaveAttribute(
      "href",
      `/reserva/sucesso?booking=${bookingId}&session_id=${checkoutSessionId}`,
    );
    expect(
      screen.queryByRole("link", { name: "Continuar pagamento" }),
    ).not.toBeInTheDocument();
  });

  it.each(["network", "server"])(
    "does not infer release after a %s failure and permits checking again",
    async (failure) => {
      const fetchMock = vi.fn();
      if (failure === "network")
        fetchMock.mockRejectedValueOnce(new Error("offline"));
      else
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: false }),
        });
      fetchMock.mockResolvedValueOnce(response(true));
      vi.stubGlobal("fetch", fetchMock);
      render(
        <ExpiredCheckoutRecovery
          bookingId={bookingId}
          checkoutSessionId={checkoutSessionId}
        />,
      );

      fireEvent.click(
        await screen.findByRole("button", { name: "Verificar novamente" }),
      );
      expect(
        await screen.findByRole("link", { name: "Continuar pagamento" }),
      ).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it("does not repeat release on unrelated rerenders", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(true));
    vi.stubGlobal("fetch", fetchMock);
    const rendered = render(
      <ExpiredCheckoutRecovery
        bookingId={bookingId}
        checkoutSessionId={checkoutSessionId}
      />,
    );
    await screen.findByRole("link", { name: "Continuar pagamento" });
    rendered.rerender(
      <ExpiredCheckoutRecovery
        bookingId={bookingId}
        checkoutSessionId={checkoutSessionId}
      />,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  });
});
