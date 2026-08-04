import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { routes } from "./routes";

describe("canonical patient route contract", () => {
  it("uses the current public and admin route decisions", () => {
    expect(routes.public.about).toBe("/sobre-nos");
    expect("howItWorks" in routes.public).toBe(false);
    expect("therapistPlans" in routes.public).toBe(false);
    expect("signIn" in routes.public).toBe(false);
    expect("signUp" in routes.public).toBe(false);
    expect(routes.admin.signIn).toBe("/admin-login");
  });

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

  it("keeps semantic legacy public URLs as redirects without restoring removed pages", () => {
    const nextConfigSource = readFileSync(
      join(process.cwd(), "next.config.mjs"),
      "utf8",
    );

    expect(nextConfigSource).toContain('source: "/como-funciona"');
    expect(nextConfigSource).toContain('destination: "/sobre-nos"');
    expect(nextConfigSource).toContain('source: "/para-terapeutas/planos"');
    expect(nextConfigSource).toContain('destination: "/para-terapeutas"');
    expect(nextConfigSource).toContain('source: "/admin/login"');
    expect(nextConfigSource).toContain('destination: "/admin-login"');
    expect(nextConfigSource).not.toContain('source: "/entrar"');
    expect(nextConfigSource).not.toContain('source: "/cadastro"');
  });
});
