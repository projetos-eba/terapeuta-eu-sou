import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MessageCenterPage } from "./message-center-page";
import type { MessageCenterPageData } from "./message-center.types";

describe("MessageCenterPage", () => {
  it("uses templates instead of a free text composer", () => {
    render(<MessageCenterPage data={createData()} />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /enviar template/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Confirmar sessão")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

function createData(): MessageCenterPageData {
  return {
    actorRole: "therapist",
    hero: {
      description:
        "Acompanhe mensagens automatizadas dos clientes, avisos da plataforma e suporte em um só lugar.",
      pendingLabel: "Clientes aguardando",
      title: "Central de mensagens",
    },
    metrics: { awaitingCount: 1, unreadCount: 1 },
    participantSection: {
      description: "Comunicações por templates.",
      title: "Mensagens dos clientes",
    },
    platformItems: [],
    platformSection: {
      description: "Comunicados da plataforma.",
      title: "Plataforma e suporte TES",
    },
    source: "demo",
    templates: {
      participant: [
        {
          body: "Confirmo que nossa sessão está mantida no horário agendado.",
          category: "confirmacao",
          key: "therapist_confirm_session",
          label: "Confirmar sessão",
        },
      ],
      support: [],
    },
    threads: [
      {
        avatarUrl: null,
        body: "Mensagem automatizada.",
        category: "confirmacao",
        categoryLabel: "Confirmação",
        conversationId: "eb000000-0000-4000-8000-000000000001",
        id: "thread-1",
        isUnread: true,
        name: "Beatriz Lima",
        timeLabel: "Hoje · 10:32",
        title: "Confirmação de presença na sessão",
      },
    ],
  };
}
