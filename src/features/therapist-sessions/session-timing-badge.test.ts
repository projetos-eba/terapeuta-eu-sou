import { describe, expect, it } from "vitest";

import { getSessionTimingBadge } from "./session-timing-badge";

describe("getSessionTimingBadge", () => {
  it("only exposes a room badge for authoritative near-session states", () => {
    expect(getSessionTimingBadge({ state: "confirmed" })).toBeNull();
    expect(getSessionTimingBadge({ state: "payment_pending" })).toBeNull();
    expect(getSessionTimingBadge({ state: "ready" })).toEqual({
      label: "Pronta para entrar",
      tone: "success",
    });
    expect(getSessionTimingBadge({ state: "in_progress" })).toEqual({
      label: "Sessão em andamento",
      tone: "info",
    });
  });
});
