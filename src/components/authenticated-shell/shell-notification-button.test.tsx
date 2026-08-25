import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShellNotificationButton } from "./shell-notification-button";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("ShellNotificationButton", () => {
  it("opens an accessible popover and closes it with Escape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => notificationResponse()),
    );

    render(
      <ShellNotificationButton
        count={1}
        href="/terapeuta/mensagens"
        role="therapist"
      />,
    );

    const button = screen.getByRole("button", {
      name: /notificações, 1 não lida/i,
    });
    fireEvent.click(button);

    expect(
      await screen.findByRole("region", { name: "Notificações recentes" }),
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Notificações recentes" }),
    ).toHaveClass("fixed", "z-overlay");
    expect(screen.getByText("Nova mensagem")).toBeVisible();
    expect(
      screen
        .getByRole("link", { name: /nova mensagem/i })
        .querySelector("svg.lucide-message-circle"),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Notificações recentes" }),
      ).toBeNull(),
    );
  });

  it("closes when the page outside the global popover is pressed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => notificationResponse()),
    );

    render(
      <ShellNotificationButton
        count={1}
        href="/terapeuta/mensagens"
        role="therapist"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /notificações/i }));
    expect(
      await screen.findByRole("region", { name: "Notificações recentes" }),
    ).toBeVisible();

    fireEvent.mouseDown(document.body);

    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Notificações recentes" }),
      ).toBeNull(),
    );
  });

  it("keeps the popover inside the viewport on narrow screens", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => notificationResponse()),
    );
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
    vi.spyOn(HTMLButtonElement.prototype, "getBoundingClientRect").mockReturnValue(
      {
        bottom: 92,
        height: 44,
        left: 286,
        right: 330,
        toJSON: () => ({}),
        top: 48,
        width: 44,
        x: 286,
        y: 48,
      } as DOMRect,
    );

    render(
      <ShellNotificationButton
        count={1}
        href="/terapeuta/mensagens"
        role="therapist"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /notificações/i }));

    const panel = await screen.findByRole("region", {
      name: "Notificações recentes",
    });
    expect(panel).toHaveStyle({ right: "22px", top: "104px" });
  });

  it("shows a temporary toast only for a confirmed booking", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => bookingNotificationResponse()),
    );

    render(
      <ShellNotificationButton
        count={1}
        href="/terapeuta/mensagens"
        role="therapist"
      />,
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Novo agendamento confirmado",
    );
    expect(screen.getByRole("link", { name: "Ver detalhes" })).toHaveAttribute(
      "href",
      "/terapeuta/sessoes/booking-1",
    );
  });

  it("marks an item as read when it is selected", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/notifications/mark-read") {
          expect(init?.method).toBe("POST");
          return Response.json({ ok: true });
        }
        return notificationResponse({ href: null });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ShellNotificationButton
        count={1}
        href="/terapeuta/mensagens"
        role="therapist"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /notificações/i }));

    fireEvent.click(
      await screen.findByRole("button", { name: /nova mensagem/i }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/notifications/mark-read",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
});

function notificationResponse(
  itemOverrides: Partial<{ href: string | null; kind: string }> = {},
) {
  return Response.json({
    count: 1,
    items: [
      {
        body: "Você recebeu uma nova mensagem na Central de mensagens.",
        createdAt: "2026-08-21T12:00:00.000Z",
        href: Object.hasOwn(itemOverrides, "href")
          ? (itemOverrides.href ?? null)
          : "/terapeuta/mensagens",
        id: "10000000-0000-4000-8000-000000000001",
        kind: itemOverrides.kind ?? "message_received",
        readAt: null,
        title: "Nova mensagem",
      },
    ],
  });
}

function bookingNotificationResponse() {
  return Response.json({
    count: 1,
    items: [
      {
        body: "Um novo encontro foi confirmado. Consulte os detalhes para se preparar.",
        createdAt: "2026-08-21T12:00:00.000Z",
        href: "/terapeuta/sessoes/booking-1",
        id: "20000000-0000-4000-8000-000000000001",
        kind: "booking_confirmed",
        readAt: null,
        title: "Novo agendamento confirmado",
      },
    ],
  });
}
