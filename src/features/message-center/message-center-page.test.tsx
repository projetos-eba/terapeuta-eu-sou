import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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

    fireEvent.click(screen.getByRole("button", { name: /escolher mensagem/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Confirmar sessão")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows the complete participant history in both directions", () => {
    render(<MessageCenterPage data={createData()} />);

    fireEvent.click(screen.getByRole("button", { name: /ver mensagens/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Mensagem recebida.")).toBeInTheDocument();
    expect(screen.getByText("Minha confirmação.")).toBeInTheDocument();
    expect(screen.getAllByText("Você").length).toBeGreaterThan(0);
  });

  it("keeps the history action beside the participant row and opens from its title", () => {
    render(<MessageCenterPage data={createData()} />);

    const threadTitle = screen.getByRole("button", {
      name: "Abrir Confirmação de presença na sessão",
    });
    const threadRow = threadTitle.closest("article");

    expect(threadRow).not.toBeNull();
    expect(threadRow).toContainElement(
      screen.getByRole("button", { name: /ver mensagens/i }),
    );

    fireEvent.click(threadTitle);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Mensagem recebida.")).toBeInTheDocument();
  });

  it("opens a platform notice when its title is selected", () => {
    render(<MessageCenterPage data={createData({ actorRole: "patient" })} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir Aviso importante" }),
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getByText("Atualização operacional."),
    ).toBeInTheDocument();
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

  it("reviews a server-resolved participant message before sending", async () => {
    const originalFetch = global.fetch;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("preview-template")) {
        return Response.json({
          ok: true,
          preview: {
            body: "Mensagem resolvida pelo TES.",
            category: "confirmacao",
            context: { bookingId: "f2000000-0000-4000-8000-000000000001" },
            cta: {
              href: "/app/encontros/f2000000-0000-4000-8000-000000000001",
              label: "Ver encontro",
            },
            recipientName: "Beatriz Lima",
          },
        });
      }
      return Response.json({ ok: true });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    try {
      render(<MessageCenterPage data={createData({ source: "supabase" })} />);
      fireEvent.click(
        screen.getByRole("button", { name: /escolher mensagem/i }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: /revisar mensagem/i }),
      );
      await waitFor(() =>
        expect(
          screen.getByText("Mensagem resolvida pelo TES."),
        ).toBeInTheDocument(),
      );
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /enviar mensagem/i }));
      await waitFor(() =>
        expect(
          screen.getByText("Mensagem enviada com segurança."),
        ).toBeInTheDocument(),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages/send-template",
        expect.objectContaining({ method: "POST" }),
      );
    } finally {
      global.fetch = originalFetch;
    }
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

  it("opens a patient support conversation after creating the ticket", async () => {
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
      render(
        <MessageCenterPage
          data={createData({ actorRole: "patient", source: "supabase" })}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /nova mensagem/i }));
      fireEvent.change(screen.getByLabelText(/assunto/i), {
        target: { value: "Dúvida sobre meu acesso" },
      });
      fireEvent.change(
        screen.getByLabelText(/conte mais sobre o que aconteceu/i),
        { target: { value: "Não consigo abrir o encontro." } },
      );
      fireEvent.click(screen.getByRole("button", { name: /abrir chamado/i }));

      await waitFor(() => expect(pushMock).toHaveBeenCalled());
      expect(pushMock).toHaveBeenCalledWith(
        "/app/mensagens/suporte/30000000-0000-4000-8000-000000000001",
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/support/tickets",
        expect.objectContaining({
          body: expect.stringContaining('"category":"financeiro_repasses"'),
          method: "POST",
        }),
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
      title: "Central de mensagens",
    },
    metrics: { openSupportTicketsCount: 1, unreadMessagesCount: 1 },
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
          description:
            "Confirma ao paciente que a sessão permanece no horário combinado.",
          key: "therapist_confirm_session",
          label: "Confirmar sessão",
          parameters: [],
        },
      ],
      support: [
        {
          body: "Preciso de apoio sobre repasse, financeiro ou assinatura.",
          category: "financeiro",
          description:
            "Abra um chamado para receber ajuda da equipe TES sobre este tema.",
          key: "therapist_support_finance",
          label: "Financeiro",
          parameters: [],
        },
      ],
    },
    threads: [
      {
        avatarUrl: null,
        body: "Mensagem automatizada.",
        bookingId: null,
        category: "confirmacao",
        categoryLabel: "Confirmação",
        conversationId: "eb000000-0000-4000-8000-000000000001",
        id: "thread-1",
        isUnread: true,
        name: "Beatriz Lima",
        timeLabel: "Hoje · 10:32",
        title: "Confirmação de presença na sessão",
        cta: null,
        messages: [
          {
            body: "Mensagem recebida.",
            createdAt: "2026-08-21T12:00:00.000Z",
            id: "message-1",
            isFromViewer: false,
          },
          {
            body: "Minha confirmação.",
            createdAt: "2026-08-21T12:05:00.000Z",
            id: "message-2",
            isFromViewer: true,
          },
        ],
        sessionContext: null,
      },
    ],
  };
}
