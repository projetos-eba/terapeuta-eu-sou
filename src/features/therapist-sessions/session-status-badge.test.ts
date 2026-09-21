import { describe, expect, it } from "vitest";

import { getTherapistSessionStatusBadge } from "./session-status-badge";

describe("therapist session status badge", () => {
  it("preserves a realized session", () => {
    expect(
      getTherapistSessionStatusBadge(
        presentation({ label: "Realizada", state: "completed" }),
      ),
    ).toEqual({ label: "Realizada", tone: "success" });
  });

  it("marks the session as realized after this participant responds", () => {
    expect(
      getTherapistSessionStatusBadge(
        presentation({
          label: "Realizada",
          state: "completed",
          tone: "success",
        }),
        true,
      ),
    ).toEqual({ label: "Realizada", tone: "success" });
  });

  it("marks a scheduled financial state as realized after the actor responds", () => {
    expect(
      getTherapistSessionStatusBadge(
        presentation({ label: "Confirmada", state: "confirmed", tone: "info" }),
        true,
      ),
    ).toEqual({ label: "Realizada", tone: "success" });
  });

  it("keeps the evaluation pending before this participant responds", () => {
    expect(
      getTherapistSessionStatusBadge(
        presentation({
          label: "Realizada",
          state: "completed",
          tone: "success",
        }),
        false,
        true,
      ),
    ).toEqual({ label: "Avaliação pendente", tone: "warning" });
  });

  it("preserves the not performed status", () => {
    expect(
      getTherapistSessionStatusBadge(
        presentation({
          label: "Não realizada",
          state: "cancelled",
          tone: "danger",
        }),
      ),
    ).toEqual({ label: "Não realizada", tone: "danger" });
  });

  it("does not turn a double no-show into an attention badge", () => {
    expect(
      getTherapistSessionStatusBadge(
        presentation({
          label: "Sessão não realizada",
          state: "cancelled",
          tone: "danger",
        }),
      ),
    ).toEqual({ label: "Sessão não realizada", tone: "danger" });
  });

  it("keeps a refunded badge after the therapist is automatically confirmed", () => {
    expect(
      getTherapistSessionStatusBadge(
        presentation({ label: "Reembolsada", state: "refunded", tone: "neutral" }),
        true,
        false,
      ),
    ).toEqual({ label: "Reembolsada", tone: "neutral" });
  });
});

function presentation(
  overrides: Partial<Parameters<typeof getTherapistSessionStatusBadge>[0]>,
) {
  return {
    actions: {
      canAccessZoom: false,
      canCancel: false,
      canComplete: false,
      canRegisterAttendance: false,
      canReschedule: false,
      primary: { action: "view_detail" as const, label: "" },
      secondary: [],
    },
    description: "",
    label: "Sessão",
    priority: "low" as const,
    state: "completed" as const,
    tone: "success" as const,
    ...overrides,
  };
}
