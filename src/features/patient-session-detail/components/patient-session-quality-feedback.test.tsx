import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SessionFeedbackReadPayload } from "@/features/session-feedback/session-feedback.types";

import { PatientSessionQualityFeedback } from "./patient-session-quality-feedback";

const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/session-feedback", () => ({
  PatientSessionFeedbackDialog: ({
    onClose,
    onSessionSubmitted,
  }: {
    onClose: () => void;
    onSessionSubmitted: (payload: SessionFeedbackReadPayload) => void;
  }) => (
    <div>
      <button onClick={() => onSessionSubmitted(confirmedPayload)} type="button">Enviar resposta simulada</button>
      <button onClick={onClose} type="button">Fechar avaliação</button>
    </div>
  ),
}));

const pendingPayload: SessionFeedbackReadPayload = {
  actorConfirmation: null,
  confirmation: null,
  feedback: null,
  realizationStatus: "performed",
  status: "eligible",
};
const confirmedPayload: SessionFeedbackReadPayload = {
  ...pendingPayload,
  actorConfirmation: {
    confirmedAt: "2026-09-17T20:00:00Z",
    dueAt: "2026-09-24T20:00:00Z",
    outcome: "completed",
    source: "manual",
  },
  status: "incident_only",
};

const reviewedPayload: SessionFeedbackReadPayload = {
  ...pendingPayload,
  feedback: {
    authorRole: "patient",
    comment: "",
    createdAt: "2026-09-17T20:00:00Z",
    id: "feedback-1",
    rating: 5,
    successful: true,
  },
  status: "submitted",
};

afterEach(() => {
  cleanup();
  refresh.mockClear();
});

describe("PatientSessionQualityFeedback", () => {
  it("updates the private feedback state on the same screen and refreshes after closing", () => {
    render(
      <PatientSessionQualityFeedback
        feedbackOpen
        initialPayload={pendingPayload}
        session={{
          bookingId: "b7f70000-0000-4000-8000-000000000001",
          dateLabel: "17 de setembro",
          serviceLabel: "Sessão de teste",
          therapist: { id: "therapist-1", name: "Terapeuta" },
          timeLabel: "17:00",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Enviar resposta simulada" }));
    expect(refresh).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Fechar avaliação" }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps the optional therapist review available after private feedback is saved", () => {
    render(
      <PatientSessionQualityFeedback
        feedbackOpen={false}
        initialPayload={reviewedPayload}
        session={{
          bookingId: "b7f70000-0000-4000-8000-000000000001",
          dateLabel: "17 de setembro",
          serviceLabel: "Sessão de teste",
          therapist: { id: "therapist-1", name: "Terapeuta" },
          timeLabel: "17:00",
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Avaliar terapeuta" })).toBeInTheDocument();
  });
});
