import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminEmailManagementList } from "./admin-email-management-list";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AdminEmailManagementList", () => {
  it("groups allowlisted events and keeps delivery history sanitized", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({
          data: {
            actions: [
              {
                actionKey: "email_verification",
                category: "Acesso e segurança",
                description: "Confirma o endereço de e-mail.",
                label: "Verificação de e-mail",
                setting: {
                  automatic_dispatch_enabled: true,
                  enabled: true,
                  sender_profile_id: null,
                },
                supportsAutomaticDispatch: true,
              },
            ],
            logs: [
              {
                action_key: "email_verification",
                attempt_count: 1,
                correlation_id: "safe-reference",
                created_at: "2026-08-21T12:00:00.000Z",
                email_sender_profiles: { provider: "hostinger_mail_api" },
                error_message: null,
                recipient_email: "pe***@example.test",
                status: "success",
              },
            ],
            senders: [
              {
                active: true,
                display_name: "TES",
                id: "sender-1",
                is_default: true,
                last_test_at: null,
                last_test_status: null,
                mailbox_address: "contato@example.test",
                provider: "hostinger_mail_api",
              },
            ],
          },
          ok: true,
        }),
        ok: true,
      })),
    );

    render(<AdminEmailManagementList />);

    expect(await screen.findByText("Eventos de e-mail")).toBeInTheDocument();
    expect(screen.getByText("Acesso e segurança")).toBeInTheDocument();
    expect(screen.getAllByText("Verificação de e-mail")).toHaveLength(2);
    expect(
      screen.getByText("pe***@example.test", { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Configurar evento/i }),
    ).toHaveAttribute(
      "href",
      "/admin/configuracoes/emails/eventos/email_verification",
    );
  });
});
