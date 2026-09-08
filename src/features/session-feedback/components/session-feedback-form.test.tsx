import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionFeedbackForm } from "./session-feedback-form";

const bookingId = "96000000-0000-4000-8000-000000000001";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SessionFeedbackForm", () => {
  it("submits a completed private feedback without sending actor identity", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: { feedback: null, status: "eligible" },
          ok: true,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            feedback: {
              authorRole: "patient",
              comment: "Boa qualidade de áudio.",
              createdAt: "2026-08-22T22:00:00.000Z",
              id: "feedback-1",
              notPerformedReason: null,
              outcome: "completed",
              rating: 4,
            },
            idempotentReplay: false,
          },
          ok: true,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SessionFeedbackForm
        actorRole="patient"
        bookingId={bookingId}
        sessionLabel="Seu encontro foi encerrado"
      />,
    );

    await screen.findByText("Como foi seu encontro?");
    fireEvent.click(screen.getByRole("button", { name: "Sim, foi realizado" }));
    expect(
      screen.getByText("Como você avalia este encontro?"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        "Compartilhe algo importante sobre este encontro…",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "4 estrelas" }));
    fireEvent.change(screen.getByLabelText(/observações/i), {
      target: { value: "Boa qualidade de áudio." },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar feedback/i }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([url]) => url === "/api/session-feedback",
      );
      expect(call?.[1]).toEqual(expect.objectContaining({ method: "POST" }));
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        bookingId,
        comment: "Boa qualidade de áudio.",
        notPerformedReason: null,
        outcome: "completed",
        rating: 4,
        requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      });
    });

    expect(document.body.textContent).not.toMatch(/actorRole|requestId/);
    expect(
      await screen.findByText("Sua confirmação foi registrada"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Sua resposta permanece privada. Obrigado por compartilhar como foi.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/prazo de segurança/i)).not.toBeInTheDocument();
  });

  it("requires a non-completion reason and preserves the 500 character limit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({
          data: { feedback: null, status: "incident_only" },
          ok: true,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SessionFeedbackForm
        actorRole="therapist"
        bookingId={bookingId}
        sessionLabel="Sua sessão foi encerrada"
      />,
    );

    await screen.findByText("Como foi sua sessão?");
    expect(
      screen.getByPlaceholderText(
        "Compartilhe algo importante sobre esta sessão…",
      ),
    ).toBeInTheDocument();
    const comment = screen.getByLabelText(/observações/i);
    fireEvent.change(comment, { target: { value: "x".repeat(600) } });

    expect(comment).toHaveValue("x".repeat(500));
    expect(
      screen.getByRole("button", { name: /enviar feedback/i }),
    ).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Problema de internet"));
    expect(
      screen.getByRole("button", { name: /enviar feedback/i }),
    ).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders an unavailable state without exposing the feedback form", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({
            data: { feedback: null, status: "unavailable" },
            ok: true,
          }),
        ),
    );

    render(
      <SessionFeedbackForm
        actorRole="patient"
        bookingId={bookingId}
        sessionLabel="Seu encontro foi encerrado"
      />,
    );

    expect(
      await screen.findByText(
        /Ainda estamos confirmando os dados deste encontro/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /enviar feedback/i }),
    ).not.toBeInTheDocument();
  });
});

function jsonResponse(payload: unknown) {
  return {
    json: async () => payload,
    ok: true,
    status: 200,
  };
}
