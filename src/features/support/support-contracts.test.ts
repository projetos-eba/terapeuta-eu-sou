import { describe, expect, it } from "vitest";

import {
  parseFutureSupportTicketCreate,
  supportTicketBodyLimit,
} from "./support-contracts";

const requestId = "10000000-0000-4000-8000-000000000001";

describe("future support ticket contract", () => {
  it("accepts controlled category and normalized plain text", () => {
    expect(
      parseFutureSupportTicketCreate({
        bookingId: null,
        category: "financeiro_repasses",
        description: "  Preciso de ajuda\ncom o repasse.  ",
        requestId,
        source: "message_center",
        subject: "  Dúvida sobre repasse  ",
      }),
    ).toEqual({
      bookingId: null,
      category: "financeiro_repasses",
      description: "Preciso de ajuda\ncom o repasse.",
      requestId,
      source: "message_center",
      subject: "Dúvida sobre repasse",
    });
  });

  it("rejects actor-selected identity, markup, invalid booking and oversized content", () => {
    const base = {
      category: "outro",
      description: "Preciso de ajuda.",
      requestId,
      source: "message_center",
      subject: "Ajuda com a conta",
    };

    expect(
      parseFutureSupportTicketCreate({ ...base, actorRole: "patient" }),
    ).toBeNull();
    expect(
      parseFutureSupportTicketCreate({ ...base, description: "<b>Ajuda</b>" }),
    ).toBeNull();
    expect(
      parseFutureSupportTicketCreate({ ...base, bookingId: "not-a-uuid" }),
    ).toBeNull();
    expect(
      parseFutureSupportTicketCreate({
        ...base,
        description: "a".repeat(supportTicketBodyLimit + 1),
      }),
    ).toBeNull();
  });
});
