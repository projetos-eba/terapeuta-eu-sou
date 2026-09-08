import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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

  it("keeps the booking service fixed and reuses the direct patient command id", async () => {
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValue("a1000000-0000-4000-8000-000000000009"),
    });
    let rescheduleAttempts = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/availability?")) {
        return Promise.resolve(jsonResponse({ ok: true, data: availability }));
      }
      rescheduleAttempts += 1;
      return Promise.resolve(
        rescheduleAttempts === 1
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

    fireEvent.click(screen.getByRole("button", { name: "Reagendar encontro" }));
    expect(await screen.findByText("Reiki")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "10:00" }));
    expect(
      screen.getByRole("heading", { name: "Confirmar reagendamento" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "O novo horário será confirmado imediatamente após a validação final da agenda.",
      ),
    ).toBeVisible();
    const submit = screen.getByRole("button", {
      name: "Confirmar reagendamento",
    });
    fireEvent.click(submit);
    expect(
      await screen.findByText("Horário indisponível."),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar reagendamento" }),
    );

    await waitFor(() => expect(navigationMocks.refresh).toHaveBeenCalledOnce());
    const rescheduleCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/api/session/reschedule"),
    );
    const first = requestPayload<{
      command: { requestId: string };
    }>(rescheduleCalls[0]);
    const second = requestPayload<{
      command: { requestId: string };
    }>(rescheduleCalls[1]);
    expect(first.command.requestId).toBe(second.command.requestId);
    expect(first).toMatchObject({
      command: { action: "request" },
    });
    expect(first.command).not.toHaveProperty("serviceId");
  });

  it("shows the full next-slot component before patient cancellation", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse({ ok: true, data: fullAvailability })),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderActions();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar encontro" }));

    expect(
      await screen.findByRole("heading", {
        name: "Próximos horários disponíveis",
      }),
    ).toBeVisible();
    for (const time of ["09:00", "10:00", "11:00", "12:00", "13:00"]) {
      expect(screen.getAllByRole("button", { name: time })).toHaveLength(3);
    }
    expect(
      screen.getByRole("button", { name: "Continuar com o cancelamento" }),
    ).toBeEnabled();

    const reschedule = within(screen.getByRole("dialog")).getByRole("button", {
      name: "Reagendar encontro",
    });
    expect(reschedule).toBeDisabled();
    fireEvent.click(screen.getAllByRole("button", { name: "10:00" })[0]);
    expect(reschedule).toBeEnabled();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver agenda completa e mais horários →",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "Escolha um dia e horário" }),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("scope=month"),
      expect.objectContaining({ cache: "no-store" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Reagendar encontro",
      }),
    ).toBeEnabled();
  });

  it("keeps therapist-initiated rescheduling as a proposal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            ok: true,
            data: availability,
          }),
        ),
      ),
    );

    render(
      <SessionOperationActions
        actorRole="therapist"
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
    fireEvent.click(await screen.findByRole("button", { name: "10:00" }));

    expect(
      screen.getByRole("heading", { name: "Confirmar proposta" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Enviar proposta" }),
    ).toBeVisible();
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

const fullAvailability = {
  ...availability,
  slots: [
    ...daySlots("2026-09-14", 12),
    ...daySlots("2026-09-15", 12),
    ...daySlots("2026-09-16", 12),
    ...daySlots("2026-09-17", 12),
  ],
};

function daySlots(date: string, firstUtcHour: number) {
  return Array.from({ length: 6 }, (_, index) => {
    const startsAt = `${date}T${String(firstUtcHour + index).padStart(2, "0")}:00:00.000Z`;
    return {
      endsAt: new Date(Date.parse(startsAt) + 50 * 60_000).toISOString(),
      startsAt,
    };
  });
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
