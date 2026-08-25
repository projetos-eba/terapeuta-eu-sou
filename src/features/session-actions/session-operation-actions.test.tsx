import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigationMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: navigationMocks.refresh }),
}));

import { SessionOperationActions } from "./session-operation-actions";

describe("SessionOperationActions", () => {
  beforeEach(() => {
    navigationMocks.refresh.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("reuses the same cancellation command id after a recoverable request failure", async () => {
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValue("a1000000-0000-4000-8000-000000000001"),
    });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderActions();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar encontro" }));

    const submit = await screen.findByRole("button", {
      name: "Confirmar cancelamento",
    });
    fireEvent.click(submit);

    expect(
      await screen.findByText("Não foi possível cancelar este encontro agora."),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar cancelamento" }),
    );

    await waitFor(() => {
      expect(navigationMocks.refresh).toHaveBeenCalledOnce();
    });

    const firstPayload = requestPayload(fetchMock.mock.calls[0]);
    const secondPayload = requestPayload(fetchMock.mock.calls[1]);
    expect(firstPayload.requestId).toBe(secondPayload.requestId);
    expect(firstPayload.requestId).toBe("a1000000-0000-4000-8000-000000000001");
  });

  it("keeps a completed cancellation unavailable and explains why", () => {
    render(
      <SessionOperationActions
        actorRole="therapist"
        bookingId="b1000000-0000-4000-8000-000000000002"
        bookingVersion={1}
        canCancel={false}
        canRequestReschedule={false}
        cancelDisabledReason="O pagamento já foi reembolsado; não é possível cancelar esta sessão."
        cancellationImpactLabel="A sessão não pode ser alterada novamente."
        reschedule={null}
        rescheduleDisabledReason="A sessão não pode ser reagendada."
      />,
    );

    const cancelButton = screen.getByRole("button", {
      name: "Cancelar sessão",
    });
    expect(cancelButton).toBeDisabled();
    expect(cancelButton).toHaveAttribute(
      "aria-describedby",
      "b1000000-0000-4000-8000-000000000002-cancel-disabled-reason",
    );
    expect(
      screen.getByText(
        /Cancelamento indisponível: O pagamento já foi reembolsado/,
      ),
    ).toBeInTheDocument();
  });
});

function renderActions() {
  return render(
    <SessionOperationActions
      actorRole="patient"
      bookingId="b1000000-0000-4000-8000-000000000001"
      bookingVersion={1}
      canCancel
      canRequestReschedule={false}
      cancelDisabledReason={null}
      cancellationImpactLabel="O cancelamento seguirá a política aplicável."
      reschedule={null}
      rescheduleDisabledReason="Não disponível para este encontro."
    />,
  );
}

function requestPayload(call: unknown[]) {
  const [, request] = call as [string, RequestInit];
  return JSON.parse(String(request.body)) as { requestId: string };
}
