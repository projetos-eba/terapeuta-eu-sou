import { describe, expect, it } from "vitest";

import {
  formatSupportTicketActivity,
  formatSupportTicketProtocol,
  getSupportTicketStatusPresentation,
} from "./support-ticket-presentation";

describe("support ticket presentation", () => {
  it("uses requester language that makes the next action clear", () => {
    expect(getSupportTicketStatusPresentation("open", "requester").label).toBe(
      "Recebemos seu chamado",
    );
    expect(
      getSupportTicketStatusPresentation("waiting_support", "requester").label,
    ).toBe("Aguardando resposta do TES");
    expect(
      getSupportTicketStatusPresentation("waiting_requester", "requester")
        .label,
    ).toBe("Aguardando sua resposta");
  });

  it("uses operational language for the TES team", () => {
    expect(getSupportTicketStatusPresentation("open", "admin").label).toBe(
      "Novo chamado",
    );
    expect(
      getSupportTicketStatusPresentation("waiting_support", "admin").label,
    ).toBe("Aguardando resposta da equipe TES");
    expect(
      getSupportTicketStatusPresentation("waiting_requester", "admin").label,
    ).toBe("Aguardando resposta do solicitante");
  });

  it("formats only persisted protocol values", () => {
    expect(formatSupportTicketProtocol("582914730p")).toBe("#582914730P");
    expect(formatSupportTicketProtocol(null)).toBe("#—");
  });

  it("formats ticket activity in Brasília time", () => {
    expect(formatSupportTicketActivity("2026-09-01T02:30:00.000Z")).toBe(
      "31 de ago., 23:30",
    );
  });
});
