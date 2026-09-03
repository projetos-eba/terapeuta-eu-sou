import { describe, expect, it } from "vitest";

import { getTherapistSessionStatusBadge } from "./session-status-badge";

describe("therapist session status badge", () => {
  it("prioritizes the pending confirmation state", () => {
    expect(
      getTherapistSessionStatusBadge(
        presentation({ label: "Realizada", state: "completed" }),
        true,
      ),
    ).toEqual({ label: "Aguardando confirmação", tone: "warning" });
  });

  it("keeps the regular compact label after the pending state is cleared", () => {
    expect(
      getTherapistSessionStatusBadge(
        presentation({ label: "Realizada", state: "completed" }),
        false,
      ),
    ).toEqual({ label: "Realizada", tone: "success" });
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
