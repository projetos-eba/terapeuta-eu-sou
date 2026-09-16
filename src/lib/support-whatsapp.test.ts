import { describe, expect, it } from "vitest";

import { getSupportWhatsAppHref } from "./support-whatsapp";

describe("TES WhatsApp support links", () => {
  const bookingId = "f2000000-0000-4000-8000-000000000001";

  it("uses the same platform contact before and during the call", () => {
    for (const context of ["waiting_room", "in_call"] as const) {
      const url = new URL(getSupportWhatsAppHref(context, bookingId));
      expect(url.origin).toBe("https://wa.me");
      expect(url.pathname).toBe("/5518981058337");
      expect(url.searchParams.get("text")).toContain("Referência TES: F2000000.");
    }
  });

  it("never includes the full booking identifier or sensitive participant context", () => {
    const href = getSupportWhatsAppHref("waiting_room", bookingId);
    expect(decodeURIComponent(href)).not.toContain(bookingId);
    expect(decodeURIComponent(href)).not.toContain("horário");
    expect(decodeURIComponent(href)).not.toContain("terapeuta");
  });

  it("ignores malformed references", () => {
    expect(getSupportWhatsAppHref("in_call", "nome@exemplo.com"))
      .not.toContain("nome");
  });
});
