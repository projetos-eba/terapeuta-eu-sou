import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminEmailEventEditor } from "./admin-email-event-editor";

const detail = {
  actionKey: "therapy_catalog_request_submitted",
  allowedTokens: [],
  description: "Confirma a recepção.",
  label: "Solicitação de terapia recebida",
  preview: {
    html: "<p>Preview</p>",
    preheader: "Preview",
    subject: "Preview",
    text: "Preview",
  },
  senders: [],
  setting: {
    automatic_dispatch_enabled: true,
    enabled: true,
    html_override: "<p>Customizado</p>",
    preheader_override: "Preheader customizado",
    sender_profile_id: null,
    subject_override: "Assunto customizado",
    text_override: "Texto customizado",
  },
  supportsAutomaticDispatch: true,
  template: {
    defaults: {
      html: "<p>HTML padrão para {{recipient_name}}</p>",
      preheader: "Texto de apoio padrão",
      subject: "Assunto padrão para {{recipient_name}}",
      text: "Texto padrão para {{recipient_name}}",
    },
  },
};

const reminderDetail = {
  ...detail,
  actionKey: "booking_reminder_24h_patient",
  description:
    "Lembra a pessoa sobre um encontro confirmado 24 horas antes do horário persistido.",
  label: "Lembrete de encontro — 24 horas — pessoa",
  setting: {
    ...detail.setting,
    automatic_dispatch_enabled: false,
    enabled: false,
    html_override: null,
    preheader_override: null,
    subject_override: null,
    text_override: null,
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AdminEmailEventEditor", () => {
  it("shows the default visual content as read-only", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ data: reminderDetail, ok: true }),
        ok: true,
      })),
    );

    render(<AdminEmailEventEditor actionKey="booking_reminder_24h_patient" />);

    const subject = await screen.findByRole("textbox", { name: "Assunto" });
    expect(subject).toHaveValue("Assunto padrão para {{recipient_name}}");
    expect(subject).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Texto de apoio" })).toHaveValue(
      "Texto de apoio padrão",
    );
    expect(
      screen.getByRole("textbox", { name: "Conteúdo visual do e-mail" }),
    ).toHaveValue("<p>HTML padrão para {{recipient_name}}</p>");
    expect(
      screen.getByRole("textbox", { name: "Conteúdo visual do e-mail" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Texto" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "HTML" }),
    ).not.toBeInTheDocument();
  });

  it("copies the default template into editable fields when customization begins", async () => {
    const requests: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
        requests.push(request);
        return { json: async () => ({ data: reminderDetail, ok: true }), ok: true };
      }),
    );

    render(<AdminEmailEventEditor actionKey="booking_reminder_24h_patient" />);

    const subject = await screen.findByRole("textbox", { name: "Assunto" });
    fireEvent.click(screen.getByRole("button", { name: "Personalizado" }));
    expect(subject).toBeEnabled();
    expect(subject).toHaveValue("Assunto padrão para {{recipient_name}}");

    fireEvent.change(subject, { target: { value: "Assunto exclusivo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar configuração" }));

    await waitFor(() =>
      expect(requests.some((request) => request.action === "save")).toBe(true),
    );
    expect(requests.find((request) => request.action === "save")).toMatchObject({
      overrides: {
        html: "<p>HTML padrão para {{recipient_name}}</p>",
        preheader: "Texto de apoio padrão",
        subject: "Assunto exclusivo",
        text: "Texto padrão para {{recipient_name}}",
      },
    });
  });

  it("clears all overrides when the standard mode is saved", async () => {
    const requests: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
        requests.push(request);
        return { json: async () => ({ data: detail, ok: true }), ok: true };
      }),
    );

    render(
      <AdminEmailEventEditor actionKey="therapy_catalog_request_submitted" />,
    );

    await screen.findByRole("button", { name: "Padrão" });
    fireEvent.click(screen.getByRole("button", { name: "Padrão" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar configuração" }));

    await waitFor(() =>
      expect(requests.some((request) => request.action === "save")).toBe(true),
    );
    expect(requests.find((request) => request.action === "save")).toMatchObject({
      overrides: { html: "", preheader: "", subject: "", text: "" },
    });
  });

  it("resolves uncustomized fields from the default template in a partial override", async () => {
    const partialDetail = {
      ...detail,
      setting: {
        ...detail.setting,
        html_override: null,
        preheader_override: null,
        subject_override: "Assunto personalizado",
        text_override: null,
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ data: partialDetail, ok: true }),
        ok: true,
      })),
    );

    render(
      <AdminEmailEventEditor actionKey="therapy_catalog_request_submitted" />,
    );

    expect(
      await screen.findByRole("textbox", { name: "Assunto" }),
    ).toHaveValue("Assunto personalizado");
    expect(screen.getByRole("textbox", { name: "Texto de apoio" })).toHaveValue(
      "Texto de apoio padrão",
    );
    expect(
      screen.getByRole("textbox", { name: "Conteúdo visual do e-mail" }),
    ).toHaveValue("<p>HTML padrão para {{recipient_name}}</p>");
  });

  it("updates the visual preview automatically from the HTML field", async () => {
    const requests: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
        requests.push(request);
        const overrides = request.overrides as { html?: string } | undefined;
        return {
          json: async () => ({
            data:
              request.action === "preview"
                ? {
                    preview: {
                      ...detail.preview,
                      html: overrides?.html ?? detail.preview.html,
                    },
                  }
                : detail,
            ok: true,
          }),
          ok: true,
        };
      }),
    );

    render(
      <AdminEmailEventEditor actionKey="therapy_catalog_request_submitted" />,
    );

    const content = await screen.findByRole("textbox", {
      name: "Conteúdo visual do e-mail",
    });
    fireEvent.click(screen.getByRole("button", { name: "Personalizado" }));
    fireEvent.change(content, {
      target: { value: "<p>Conteúdo atualizado</p>" },
    });

    await waitFor(() =>
      expect(
        requests.find((request) => request.action === "preview"),
      ).toMatchObject({
        overrides: expect.objectContaining({
          html: "<p>Conteúdo atualizado</p>",
        }),
      }),
    );
  });

  it("restores defaults by persisting empty template overrides", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return {
        json: async () => ({ data: detail, ok: true }),
        ok: true,
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminEmailEventEditor actionKey="therapy_catalog_request_submitted" />,
    );

    await screen.findByRole("button", { name: "Restaurar padrão" });
    fireEvent.click(screen.getByRole("button", { name: "Restaurar padrão" }));

    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]).toMatchObject({
      action: "save",
      actionKey: "therapy_catalog_request_submitted",
      overrides: { html: "", preheader: "", subject: "", text: "" },
    });
  });

  it("persists the enabled and automatic flags for booking reminders", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return {
        json: async () => ({ data: reminderDetail, ok: true }),
        ok: true,
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminEmailEventEditor actionKey="booking_reminder_24h_patient" />);

    await screen.findByRole("switch", { name: "Mensagem habilitada" });
    fireEvent.click(
      screen.getByRole("switch", { name: "Mensagem habilitada" }),
    );
    fireEvent.click(screen.getByRole("switch", { name: "Envio automático" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar configuração" }),
    );

    await waitFor(() =>
      expect(requests.some((request) => request.action === "save")).toBe(true),
    );
    const saveRequest = requests.find((request) => request.action === "save");
    expect(saveRequest).toMatchObject({
      action: "save",
      actionKey: "booking_reminder_24h_patient",
      automaticDispatchEnabled: true,
      enabled: true,
    });
  });

  it("shows the mailbox address instead of the sender display name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({
          data: {
            ...detail,
            senders: [
              {
                active: true,
                display_name: "Equipe TES",
                id: "sender-1",
                is_default: true,
                mailbox_address: "contato@terapeutaeusou.com.br",
                provider: "hostinger_mail_api",
              },
            ],
          },
          ok: true,
        }),
        ok: true,
      })),
    );

    render(
      <AdminEmailEventEditor actionKey="therapy_catalog_request_submitted" />,
    );

    expect(
      await screen.findByRole("option", {
        name: "contato@terapeutaeusou.com.br (padrão)",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Equipe TES (padrão)" }),
    ).not.toBeInTheDocument();
  });
});
