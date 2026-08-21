import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MessageCenterPage } from "./message-center-page";
import type { MessageCenterPageData } from "./message-center.types";

const refreshMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

afterEach(() => {
  cleanup();
  refreshMock.mockClear();
  pushMock.mockClear();
});

describe("MessageCenterPage", () => {
  it("uses templates instead of a free text composer", () => {
    render(<MessageCenterPage data={createData()} />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /enviar template/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Confirmar sessão")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("keeps support visually separate from protected participant messaging", () => {
    render(<MessageCenterPage data={createData()} />);

    expect(
      screen.getByRole("heading", { name: "Suporte TES" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Novo chamado" }),
    ).toBeInTheDocument();
  });

  it("selects the hero asset for the active profile", () => {
    const therapist = render(<MessageCenterPage data={createData()} />);

    expect(therapist.container.innerHTML).toContain(
      "therapist-messages-hero.png",
    );

    therapist.unmount();

    const patient = render(
      <MessageCenterPage data={createData({ actorRole: "patient" })} />,
    );

    expect(patient.container.innerHTML).toContain("patient-messages-hero.png");
  });

  it("opens a free-text support ticket without exposing a patient composer", async () => {
    const originalFetch = global.fetch;
    const fetchMock = vi.fn(async () =>
      Response.json({
        ok: true,
        ticket: {
          id: "30000000-0000-4000-8000-000000000001",
          protocol: "30000000",
          status: "open",
        },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    try {
      render(<MessageCenterPage data={createData({ source: "supabase" })} />);

      fireEvent.click(screen.getByRole("button", { name: /novo chamado/i }));
      fireEvent.change(screen.getByLabelText(/categoria/i), {
        target: { value: "financeiro_repasses" },
      });
      fireEvent.change(screen.getByLabelText(/assunto/i), {
        target: { value: "Dúvida sobre repasse" },
      });
      fireEvent.change(
        screen.getByLabelText(/conte mais sobre o que aconteceu/i),
        {
          target: { value: "Preciso entender meu próximo repasse." },
        },
      );
      fireEvent.click(screen.getByRole("button", { name: /abrir chamado/i }));

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/support/tickets",
          expect.objectContaining({
            body: expect.stringContaining("financeiro_repasses"),
            method: "POST",
          }),
        ),
      );
      expect(pushMock).toHaveBeenCalledWith(
        "/terapeuta/mensagens/suporte/30000000-0000-4000-8000-000000000001",
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});

function createData(
  overrides: Partial<Pick<MessageCenterPageData, "actorRole" | "source">> = {},
): MessageCenterPageData {
  return {
    actorRole: overrides.actorRole ?? "therapist",
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
    platformItems: [
      {
        body: "Atualização operacional.",
        category: "plataforma",
        categoryLabel: "Plataforma",
        id: "notification-1",
        isUnread: true,
        timeLabel: "Hoje · 10:00",
        title: "Aviso importante",
      },
    ],
    supportTickets: [],
    platformSection: {
      description: "Comunicados da plataforma.",
      title: "Plataforma e suporte TES",
    },
    source: overrides.source ?? "demo",
    templates: {
      participant: [
        {
          body: "Confirmo que nossa sessão está mantida no horário agendado.",
          category: "confirmacao",
          key: "therapist_confirm_session",
          label: "Confirmar sessão",
        },
      ],
      support: [
        {
          body: "Preciso de apoio sobre repasse, financeiro ou assinatura.",
          category: "financeiro",
          key: "therapist_support_finance",
          label: "Financeiro",
        },
      ],
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
