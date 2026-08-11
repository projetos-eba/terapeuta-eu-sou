import { describe, expect, it } from "vitest";

import {
  buildMonogram,
  formatAuditActionLabel,
  formatPlanLabel,
  formatStatusLabel,
} from "./admin-operation-display";

describe("admin operation display helpers", () => {
  it("formats admin statuses into product labels", () => {
    expect(formatStatusLabel("draft")).toBe("Perfil em construção");
    expect(formatStatusLabel("submitted")).toBe("Aguardando análise");
    expect(formatStatusLabel("in_review")).toBe("Em análise");
    expect(formatStatusLabel("changes_requested")).toBe("Ajustes solicitados");
    expect(formatStatusLabel("rejected")).toBe("Não aprovado");
    expect(formatStatusLabel("active")).toBe("Ativo");
  });

  it("formats plan labels without legacy route jargon", () => {
    expect(formatPlanLabel("premium_plus")).toBe("Premium Plus");
    expect(formatPlanLabel("premium")).toBe("Premium");
    expect(formatPlanLabel("free")).toBe("Free");
  });

  it("formats audit actions into product copy", () => {
    expect(formatAuditActionLabel("verification.pause_review")).toBe(
      "Ajustes solicitados",
    );
    expect(formatAuditActionLabel("professional.suspend")).toBe(
      "Profissional suspenso",
    );
  });

  it("builds monograms from display names", () => {
    expect(buildMonogram("Camila Oliveira")).toBe("CO");
    expect(buildMonogram("Mariana")).toBe("M");
    expect(buildMonogram("")).toBe("AD");
  });
});
