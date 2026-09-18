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

afterEach(() => {
  cleanup();
  refresh.mockClear();
});

describe("PatientSessionQualityFeedback", () => {
  it("updates the own participation on the same screen and refreshes after closing", () => {
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

    expect(screen.getByText(/sua confirmação ainda está pendente/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar resposta simulada" }));
    expect(screen.getByText("Sua participação está confirmada.")).toBeInTheDocument();
    expect(screen.queryByText(/sua confirmação ainda está pendente/i)).toBeNull();
    expect(refresh).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Fechar avaliação" }));
    expect(refresh).toHaveBeenCalledOnce();
  });
});
