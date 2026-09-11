import { describe, expect, it } from "vitest";

import { getTherapistSessionStatusBadge } from "./session-status-badge";

describe("therapist session status badge", () => {
  it("does not overwrite a confirmed completed session", () => {
    expect(
      getTherapistSessionStatusBadge(
        presentation({ label: "Realizada", state: "completed" }),
        true,
      ),
    ).toEqual({ label: "Realizada", tone: "success" });
  });

  it("uses the pending confirmation label only for non-terminal sessions", () => {
    expect(
      getTherapistSessionStatusBadge(
        presentation({ label: "Confirmada", state: "confirmed", tone: "info" }),
        true,
      ),
    ).toEqual({ label: "Aguardando confirmação", tone: "warning" });
  });

  it("preserves the not performed status even if stale pending data arrives", () => {
    expect(
      getTherapistSessionStatusBadge(
        presentation({ label: "Não realizada", state: "cancelled", tone: "danger" }),
        true,
      ),
    ).toEqual({ label: "Não realizada", tone: "danger" });
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
