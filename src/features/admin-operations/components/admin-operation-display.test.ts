import { describe, expect, it } from "vitest";

import {
  buildMonogram,
  formatAuditActionLabel,
  formatPlanLabel,
  formatSessionPaymentStatusLabel,
  formatSessionStatusLabel,
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
    expect(formatStatusLabel("cancelled_by_payment")).toBe(
      "Cancelada por falha no pagamento",
    );
    expect(formatStatusLabel("no_show_patient")).toBe(
      "Não realizada — cliente ausente",
    );
  });

  it("formats every canonical session payment status without leaking enums", () => {
    expect(formatSessionPaymentStatusLabel("not_started")).toBe("Não iniciado");
    expect(formatSessionPaymentStatusLabel("pending")).toBe("Pendente");
    expect(formatSessionPaymentStatusLabel("paid")).toBe("Confirmado");
    expect(formatSessionPaymentStatusLabel("failed")).toBe("Falhou");
    expect(formatSessionPaymentStatusLabel("refunded")).toBe("Reembolsado");
    expect(formatSessionPaymentStatusLabel("partially_refunded")).toBe(
      "Reembolso parcial",
    );
    expect(formatSessionPaymentStatusLabel("cancelled")).toBe("Cancelado");
    expect(formatSessionPaymentStatusLabel("canceled")).toBe("Cancelado");
    expect(formatSessionPaymentStatusLabel("unexpected_status")).toBe(
      "Situação indisponível",
    );
  });

  it("keeps draft wording scoped to the session context", () => {
    expect(formatStatusLabel("draft")).toBe("Perfil em construção");
    expect(formatSessionStatusLabel("draft")).toBe("Rascunho");
    expect(formatSessionStatusLabel("cancelled_by_therapist")).toBe(
      "Cancelada pelo terapeuta",
    );
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
