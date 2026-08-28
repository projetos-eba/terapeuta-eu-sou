export type SupportEventActorRole = "admin" | "patient" | "therapist";

export type SupportEventTable =
  | "messages"
  | "support_ticket_message_attachments"
  | "support_ticket_messages"
  | "support_tickets";

export type SupportEventSubscription = {
  filter?: string;
  table: SupportEventTable;
};

export function getSupportEventSubscriptions({
  role,
  ticketId,
  userId,
}: {
  role: SupportEventActorRole;
  ticketId: string | null;
  userId: string;
}): SupportEventSubscription[] {
  if (ticketId) {
    return [
      { filter: `id=eq.${ticketId}`, table: "support_tickets" },
      {
        filter: `ticket_id=eq.${ticketId}`,
        table: "support_ticket_messages",
      },
      {
        filter: `ticket_id=eq.${ticketId}`,
        table: "support_ticket_message_attachments",
      },
    ];
  }

  return [
    {
      filter:
        role === "admin" ? undefined : `requester_profile_id=eq.${userId}`,
      table: "support_tickets",
    },
    { table: "messages" },
  ];
}
