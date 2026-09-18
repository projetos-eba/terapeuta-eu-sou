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
  it("offers the separate public therapist review after a persisted positive V2 response without confirmations", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) =>
      jsonResponse({
        ok: true,
        data: url.startsWith("/api/patient/reviews")
          ? { eligible: true, review: null, therapistProfileId: "therapist-1" }
          : {
              contractVersion: 2,
              sessionAttemptId: bookingId,
              actorRole: "patient",
              realizationStatus: "performed",
              confirmation: null,
              counterpartConfirmation: null,
              status: "submitted",
              feedback: {
                ...completedTherapistFeedback(),
                authorRole: "patient",
                successful: true,
              },
            },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <SessionFeedbackForm
        actorRole="patient"
        bookingId={bookingId}
        publicReviewTherapist={{ id: "therapist-1", name: "Ana" }}
        sessionLabel="Encontro encerrado"
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Avaliar terapeuta (opcional)",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "Avaliar Ana publicamente" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Enviar feedback" }),
    ).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.every(
        ([, options]) => !options?.method || options.method === "GET",
      ),
    ).toBe(true);
  });

  it.each(["patient", "therapist"] as const)(
    "preserves the %s response and request ID for retry after a rejected submission",
    async (actorRole) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            ok: true,
            data: {
              contractVersion: 2,
              sessionAttemptId: bookingId,
              feedback: null,
              status: "eligible",
            },
          }),
        )
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            ok: false,
            error: { message: "Revise os dados do feedback." },
          }),
        })
        .mockResolvedValueOnce(
          jsonResponse({
            ok: true,
            data: {
              feedback: {
                ...completedTherapistFeedback(),
                authorRole: actorRole,
                successful: true,
              },
            },
          }),
        )
        .mockRejectedValueOnce(new Error("temporary read failure"));
      vi.stubGlobal("fetch", fetchMock);
      const onSubmitted = vi.fn();
      render(
        <SessionFeedbackForm
          actorRole={actorRole}
          bookingId={bookingId}
          onSubmitted={onSubmitted}
          sessionLabel="Sessão encerrada"
        />,
      );
      fireEvent.click(await screen.findByRole("button", { name: "Sim" }));
      fireEvent.click(screen.getByRole("button", { name: "5 estrelas" }));
      fireEvent.change(screen.getByLabelText(/observações/i), {
        target: { value: "Teste de homologação." },
      });
      fireEvent.click(screen.getByRole("button", { name: "Enviar feedback" }));
      expect(
        await screen.findByText("Revise os dados do feedback."),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/observações/i)).toHaveValue(
        "Teste de homologação.",
      );
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Enviar feedback" }),
        ).toBeEnabled(),
      );
      fireEvent.click(screen.getByRole("button", { name: "Enviar feedback" }));
      await waitFor(() =>
        expect(onSubmitted).toHaveBeenCalledWith(
          expect.objectContaining({ authorRole: actorRole }),
          expect.objectContaining({
            status: "submitted",
            feedback: expect.objectContaining({ successful: true }),
            sessionAttemptId: bookingId,
          }),
        ),
      );
      const posts = fetchMock.mock.calls.filter(
        ([url]) => url === "/api/session-feedback",
      );
      expect(JSON.parse(posts[0][1].body).requestId).toBe(
        JSON.parse(posts[1][1].body).requestId,
      );
    },
  );

  it.each(["patient", "therapist"] as const)(
    "does not offer public review for a negative %s quality response",
    async (actorRole) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse({
            ok: true,
            data: {
              status: "submitted",
              feedback: {
                ...completedTherapistFeedback(),
                authorRole: actorRole,
                successful: false,
                rating: null,
              },
            },
          }),
        ),
      );
      render(
        <SessionFeedbackForm
          actorRole={actorRole}
          bookingId={bookingId}
          publicReviewTherapist={{ id: "therapist-1", name: "Ana" }}
          sessionLabel="Sessão encerrada"
        />,
      );
      await screen.findByText("Sua avaliação foi registrada");
      expect(
        screen.queryByRole("button", { name: "Avaliar terapeuta (opcional)" }),
      ).not.toBeInTheDocument();
    },
  );
  it("submits private quality feedback with the correct session role", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            sessionAttemptId: bookingId,
            contractVersion: 2,
            feedback: null,
            status: "eligible",
          },
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
    expect(screen.getByText(/sua avaliação é privada/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/pagamento|reembolso|repasse/i),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sim" }));
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
        actorRole: "patient",
        bookingId,
        comment: "Boa qualidade de áudio.",
        contractVersion: 2,
        sessionAttemptId: bookingId,
        successful: true,
        qualityReason: null,
        rating: 4,
        requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      });
    });

    expect(document.body.textContent).not.toMatch(/actorRole|requestId/);
    expect(
      await screen.findByText("Sua avaliação foi registrada"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Obrigado por compartilhar como foi."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/prazo de segurança/i)).not.toBeInTheDocument();
  });

  it("requires a non-completion reason and preserves the 500 character limit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          sessionAttemptId: bookingId,
          feedback: null,
          status: "eligible",
        },
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
    fireEvent.click(await screen.findByRole("button", { name: "Não" }));
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

  it("renders a useful unavailable state without exposing the feedback form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
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
        "A avaliação ficará disponível depois do encerramento deste encontro.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Como foi seu encontro?")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /enviar feedback/i }),
    ).not.toBeInTheDocument();
  });

  it("shows a completed automatic deadline without reopening the quality form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: { feedback: null, status: "automatically_confirmed" },
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
      await screen.findByText(/está registrado como realizado/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /enviar feedback/i }),
    ).not.toBeInTheDocument();
  });

  it("does not ask again after a manual response from the current attempt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: { feedback: null, status: "previously_recorded" },
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

    expect(await screen.findByText(/Sua resposta anterior já foi registrada/))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enviar feedback/i }))
      .not.toBeInTheDocument();
  });

  it("shows journey themes after completed therapist feedback when enabled", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            feedback: completedTherapistFeedback(),
            status: "submitted",
          },
          ok: true,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { selection: null }, ok: true }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SessionFeedbackForm
        actorRole="therapist"
        bookingId={bookingId}
        sessionLabel="Sua sessão foi encerrada"
        showJourneyThemes
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Quais foram os temas da sua sessão?",
      }),
    ).toBeInTheDocument();
  });

  it.each([
    [false, completedTherapistFeedback()],
    [
      true,
      {
        ...completedTherapistFeedback(),
        outcome: "not_performed",
        rating: null,
      },
    ],
  ] as const)(
    "does not show journey themes when the plan gate is %s or the session was not completed",
    async (showJourneyThemes, feedback) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            jsonResponse({ data: { feedback, status: "submitted" }, ok: true }),
          ),
      );

      render(
        <SessionFeedbackForm
          actorRole="therapist"
          bookingId={bookingId}
          sessionLabel="Sua sessão foi encerrada"
          showJourneyThemes={showJourneyThemes}
        />,
      );

      await screen.findByText("Sua avaliação foi registrada");
      expect(
        screen.queryByRole("heading", {
          name: "Quais foram os temas da sua sessão?",
        }),
      ).not.toBeInTheDocument();
    },
  );
});

function completedTherapistFeedback() {
  return {
    authorRole: "therapist" as const,
    comment: "",
    createdAt: "2026-09-11T18:00:00.000Z",
    id: "feedback-therapist-1",
    notPerformedReason: null,
    outcome: "completed" as const,
    rating: 5,
  };
}

function jsonResponse(payload: unknown) {
  return {
    json: async () => payload,
    ok: true,
    status: 200,
  };
}
