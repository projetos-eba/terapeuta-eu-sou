import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  supportTicketAttachmentGuidance,
  supportTicketWaitingSupportMessage,
} from "../support-ticket-presentation";

vi.mock("./support-live-refresh", () => ({
  useSupportLiveRefresh: vi.fn(),
}));

import { SupportTicketPage } from "./therapist-support-ticket-page";

const ticket = {
  bookingId: null,
  category: "outro",
  createdAt: "2026-09-01T12:00:00Z",
  id: "30000000-0000-4000-8000-000000000001",
  lastActivityAt: "2026-09-01T12:00:00Z",
  messages: [
    {
      author_role: "therapist" as const,
      body: "Mensagem enviada.",
      created_at: "2026-09-01T12:00:00Z",
      id: "40000000-0000-4000-8000-000000000001",
    },
  ],
  protocol: "582914730F",
  resolvedAt: null,
  status: "waiting_support",
  subject: "Dúvida sobre suporte",
};

describe("SupportTicketPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps reply and attachment controls available while TES is responding", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ ticket })),
    );

    render(<SupportTicketPage actorRole="therapist" ticketId={ticket.id} />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      supportTicketWaitingSupportMessage,
    );
    expect(screen.getByText("Responder ao suporte")).toBeInTheDocument();
    expect(screen.getByText("Adicionar arquivo")).toBeInTheDocument();
    expect(
      screen.getByText(supportTicketAttachmentGuidance),
    ).toBeInTheDocument();
  });

  it("shows the attachment size and format guidance when a reply is allowed", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ ticket: { ...ticket, status: "open" } }),
        ),
    );

    render(<SupportTicketPage actorRole="therapist" ticketId={ticket.id} />);

    await waitFor(() =>
      expect(
        screen.getByText(supportTicketAttachmentGuidance),
      ).toBeInTheDocument(),
    );
    expect(document.querySelector('input[type="file"]')).toHaveAttribute(
      "accept",
      "application/pdf,image/jpeg,image/png,image/webp",
    );
  });
});
