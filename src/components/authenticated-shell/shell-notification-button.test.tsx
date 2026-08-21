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

    render(<ShellNotificationButton count={1} href="/terapeuta/mensagens" />);

    const button = screen.getByRole("button", {
      name: /notificações, 1 não lida/i,
    });
    fireEvent.click(button);

    expect(
      await screen.findByRole("region", { name: "Notificações recentes" }),
    ).toBeVisible();
    expect(screen.getByText("Nova mensagem")).toBeVisible();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Notificações recentes" }),
      ).toBeNull(),
    );
  });

  it("shows a temporary toast only for a confirmed booking", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => bookingNotificationResponse()),
    );

    render(<ShellNotificationButton count={1} href="/terapeuta/mensagens" />);

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

    render(<ShellNotificationButton count={1} href="/terapeuta/mensagens" />);
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
  itemOverrides: Partial<{ href: string | null }> = {},
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
        kind: "message_received",
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
