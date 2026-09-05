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
    let cancellationAttempts = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/availability?")) {
        return Promise.resolve(jsonResponse({ ok: true, data: availability }));
      }
      cancellationAttempts += 1;
      if (cancellationAttempts === 1) {
        return Promise.reject(new TypeError("network unavailable"));
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderActions();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar encontro" }));

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Continuar com o cancelamento",
      }),
    );
    fireEvent.change(screen.getByLabelText(/Motivo\s+do cancelamento/), {
      target: { value: "Minha rotina mudou." },
    });
    const submit = screen.getByRole("button", {
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

    const cancellationCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/api/session/cancel"),
    );
    const firstPayload = requestPayload<{ requestId: string }>(
      cancellationCalls[0],
    );
    const secondPayload = requestPayload<{ requestId: string }>(
      cancellationCalls[1],
    );
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

  it("keeps the booking service fixed and reuses the proposal command id", async () => {
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValue("a1000000-0000-4000-8000-000000000009"),
    });
    let proposalAttempts = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/availability?")) {
        return Promise.resolve(jsonResponse({ ok: true, data: availability }));
      }
      proposalAttempts += 1;
      return Promise.resolve(
        proposalAttempts === 1
          ? jsonResponse(
              { ok: false, error: { message: "Horário indisponível." } },
              409,
            )
          : jsonResponse({ ok: true }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SessionOperationActions
        actorRole="patient"
        bookingId="b1000000-0000-4000-8000-000000000001"
        bookingVersion={1}
        canCancel
        canRequestReschedule
        cancelDisabledReason={null}
        cancellationImpactLabel="Política aplicável."
        reschedule={null}
        rescheduleDisabledReason={null}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Solicitar reagendamento" }),
    );
    expect(await screen.findByText("Reiki")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "10:00" }));
    const submit = screen.getByRole("button", { name: "Enviar proposta" });
    fireEvent.click(submit);
    expect(
      await screen.findByText("Horário indisponível."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar proposta" }));

    await waitFor(() => expect(navigationMocks.refresh).toHaveBeenCalledOnce());
    const proposalCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/api/session/reschedule"),
    );
    const first = requestPayload<{
      command: { requestId: string };
    }>(proposalCalls[0]);
    const second = requestPayload<{
      command: { requestId: string };
    }>(proposalCalls[1]);
    expect(first.command.requestId).toBe(second.command.requestId);
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

function requestPayload<T>(call: unknown[]) {
  const [, request] = call as [string, RequestInit];
  return JSON.parse(String(request.body)) as T;
}

const availability = {
  booking: {
    id: "b1000000-0000-4000-8000-000000000001",
    startsAt: "2026-09-12T13:00:00.000Z",
    version: 1,
  },
  horizonEndsAt: "2026-12-01T00:00:00.000Z",
  service: {
    currency: "BRL",
    durationMinutes: 50,
    id: "c1000000-0000-4000-8000-000000000001",
    priceCents: 12300,
    therapyName: "Reiki",
    title: "Sessão de Reiki",
  },
  slots: [
    {
      endsAt: "2026-09-14T13:50:00.000Z",
      startsAt: "2026-09-14T13:00:00.000Z",
    },
  ],
  timezone: "America/Sao_Paulo",
};

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
