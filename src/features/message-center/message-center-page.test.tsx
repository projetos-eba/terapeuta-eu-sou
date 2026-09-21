import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MessageCenterPage } from "./message-center-page";
import type { MessageCenterPageData } from "./message-center.types";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

afterEach(() => {
  cleanup();
  pushMock.mockClear();
  refreshMock.mockClear();
});

const data: MessageCenterPageData = {
  actorRole: "therapist",
  hero: {
    description: "Converse com a equipe TES e acompanhe seus chamados.",
    title: "Suporte TES",
  },
  metrics: { openSupportTicketsCount: 1, unreadMessagesCount: 0 },
  participantPagination: { hasNext: false, page: 1, pageSize: 10, total: 0 },
  participantSection: { description: "", title: "" },
  platformItems: [
    {
      body: "A equipe TES enviou uma atualização.",
      category: "plataforma",
      categoryLabel: "Plataforma",
      id: "notice-1",
      isNotification: true,
      isUnread: true,
      timeLabel: "Hoje",
      title: "Aviso TES",
    },
  ],
  platformSection: { description: "", title: "Avisos TES" },
  source: "demo",
  supportPagination: { hasNext: false, page: 1, pageSize: 10, total: 1 },
  supportTickets: [
    {
      category: "outro",
      createdAt: "2026-09-15T12:00:00.000Z",
      excerpt: "Acompanhando seu chamado.",
      id: "30000000-0000-4000-8000-000000000001",
      lastActivityAt: "2026-09-15T12:00:00.000Z",
      protocol: "582914730P",
      status: "open",
      subject: "Ajuda com minha conta",
    },
  ],
  templates: { participant: [], support: [] },
  threads: [],
};

describe("Support center page", () => {
  it("shows only TES support, tickets and platform notices", () => {
    render(<MessageCenterPage data={data} />);

    expect(screen.getByRole("heading", { name: "Suporte TES", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Chamados abertos 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo chamado" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Avisos TES" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /mensagens dos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /escolher mensagem|ver mensagens/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/mensagens não lidas/i)).not.toBeInTheDocument();
  });

  it("opens a ticket in the canonical support route", () => {
    render(<MessageCenterPage data={data} />);
    expect(screen.getByText("Ajuda com minha conta")).toBeInTheDocument();
    expect(screen.getByText(/582914730P/)).toBeInTheDocument();
  });

  it("uses TESDialog for a new support ticket", () => {
    render(<MessageCenterPage data={data} />);
    fireEvent.click(screen.getByRole("button", { name: "Novo chamado" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
