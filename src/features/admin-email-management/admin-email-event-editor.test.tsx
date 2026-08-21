import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

afterEach(() => {
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
});
