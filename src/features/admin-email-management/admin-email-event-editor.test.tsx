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

    await screen.findByRole("switch", { name: "Evento habilitado" });
    fireEvent.click(screen.getByRole("switch", { name: "Evento habilitado" }));
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
});
