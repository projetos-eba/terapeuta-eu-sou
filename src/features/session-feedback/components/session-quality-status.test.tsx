import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SessionQualityStatus } from "./session-quality-status";

const payload = {
  confirmation: null,
  feedback: null,
  realizationStatus: "performed" as const,
  status: "automatically_confirmed" as const,
};

describe("SessionQualityStatus", () => {
  it("uses the correct subject in each participant's completed state", () => {
    expect(renderToStaticMarkup(<SessionQualityStatus payload={payload} actorRole="patient" />))
      .toContain("Encontro realizado");
    expect(renderToStaticMarkup(<SessionQualityStatus payload={payload} actorRole="therapist" />))
      .toContain("Sessão realizada");
  });
});
