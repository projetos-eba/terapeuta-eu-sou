import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { routes } from "./routes";

describe("canonical patient route contract", () => {
  it("uses /app/encontros as the canonical patient encounter namespace", () => {
    expect(routes.patient.encounters).toBe("/app/encontros");
    expect(routes.patient.encounterDetail("booking-1")).toBe(
      "/app/encontros/booking-1",
    );
    expect(routes.legacyPatient.sessions).toBe("/app/sessoes");
  });

  it("keeps legacy patient session URLs as redirects", async () => {
    const nextConfigSource = readFileSync(
      join(process.cwd(), "next.config.mjs"),
      "utf8",
    );

    expect(nextConfigSource).toContain('source: "/app/sessoes"');
    expect(nextConfigSource).toContain('destination: "/app/encontros"');
    expect(nextConfigSource).toContain('source: "/app/sessoes/:bookingId"');
    expect(nextConfigSource).toContain(
      'destination: "/app/encontros/:bookingId"',
    );
    expect(nextConfigSource).toContain('source: "/app/sessoes/historico"');
    expect(nextConfigSource).toContain(
      'destination: "/app/encontros#patient-history-encounters-title"',
    );
  });
});
