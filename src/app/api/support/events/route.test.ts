import { describe, expect, it } from "vitest";

import { getSupportEventSubscriptions } from "@/features/support/support-event-subscriptions";

const ticketId = "30000000-0000-4000-8000-000000000001";
const userId = "20000000-0000-4000-8000-000000000001";

describe("support event subscriptions", () => {
  it("uses the ticket primary key only for the ticket table in detail", () => {
    expect(
      getSupportEventSubscriptions({
        role: "therapist",
        ticketId,
        userId,
      }),
    ).toEqual([
      { filter: `id=eq.${ticketId}`, table: "support_tickets" },
      {
        filter: `ticket_id=eq.${ticketId}`,
        table: "support_ticket_messages",
      },
      {
        filter: `ticket_id=eq.${ticketId}`,
        table: "support_ticket_message_attachments",
      },
    ]);
  });

  it("subscribes a requester inbox only to its ticket rows and participant messages", () => {
    expect(
      getSupportEventSubscriptions({ role: "patient", ticketId: null, userId }),
    ).toEqual([
      {
        filter: `requester_profile_id=eq.${userId}`,
        table: "support_tickets",
      },
      { table: "messages" },
    ]);
  });

  it("keeps the admin inbox broad without globally subscribing to support child rows", () => {
    expect(
      getSupportEventSubscriptions({ role: "admin", ticketId: null, userId }),
    ).toEqual([{ table: "support_tickets" }, { table: "messages" }]);
  });
});
