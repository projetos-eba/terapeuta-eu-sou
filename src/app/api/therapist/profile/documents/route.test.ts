import { beforeEach, describe, expect, it, vi } from "vitest";

const headerMocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookies: vi.fn(),
}));

const configMocks = vi.hoisted(() => ({
  getSupabasePublicConfig: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: headerMocks.cookies,
}));

vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: configMocks.getSupabasePublicConfig,
}));

import { POST } from "./route";

describe("therapist profile documents route", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    headerMocks.cookieGet.mockReset();
    headerMocks.cookies.mockReset();
    configMocks.getSupabasePublicConfig.mockReset();

    headerMocks.cookieGet.mockReturnValue({ value: "therapist-token" });
    headerMocks.cookies.mockResolvedValue({ get: headerMocks.cookieGet });
    configMocks.getSupabasePublicConfig.mockReturnValue({
      apiKey: "publishable-key",
      url: "https://tes.supabase.test",
    });
  });

  it("requires an authenticated therapist session", async () => {
    headerMocks.cookieGet.mockReturnValue(undefined);

    const response = await POST(
      makeRequest({
        file: makePdfFile("rg.pdf"),
        kind: "identity_document",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.message).toBe("Entre na sua conta para continuar.");
  });

  it("rejects unsupported files before forwarding to Supabase", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeRequest({
        file: new File(["bad"], "rg.txt", { type: "text/plain" }),
        kind: "identity_document",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error.message).toBe("Envie um arquivo em PDF, JPG ou PNG.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects WebP documents before forwarding to Supabase", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeRequest({
        file: new File(["RIFFxxxxWEBP"], "rg.webp", { type: "image/webp" }),
        kind: "identity_document",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error.message).toBe("Envie um arquivo em PDF, JPG ou PNG.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("states the 10 MB limit clearly before forwarding oversized documents", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeRequest({
        file: new File([new Uint8Array(10 * 1024 * 1024 + 1)], "rg.pdf", {
          type: "application/pdf",
        }),
        kind: "identity_document",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error.message).toBe(
      "Não foi possível concluir a operação, o tamanho do documento excede o limite de 10 MB.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards valid documents to the therapist profile command function", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        data: {
          document: {
            createdAt: "2026-08-15T12:00:00.000Z",
            fileName: "rg.pdf",
            fileSizeBytes: 1200,
            id: "document-1",
            kind: "identity_document",
            mimeType: "application/pdf",
            status: "uploaded",
            updatedAt: "2026-08-15T12:00:00.000Z",
            validationState: "not_scanned",
          },
          documents: [],
          verificationSummary: null,
        },
        ok: true,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeRequest({
        file: makePdfFile("rg.pdf"),
        kind: "identity_document",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tes.supabase.test/functions/v1/therapist-private-documents",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer therapist-token",
        }),
        method: "POST",
      }),
    );
  });

  it("returns a sanitized error when the upstream function fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: { message: "Não foi possível enviar o documento agora." },
            ok: false,
          },
          { status: 502 },
        ),
      ),
    );

    const response = await POST(
      makeRequest({
        file: makePdfFile("rg.pdf"),
        kind: "identity_document",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error.message).toBe(
      "Não foi possível enviar o documento agora.",
    );
  });
});

function makeRequest({
  file,
  kind,
}: {
  file: File;
  kind: "address_proof" | "identity_document";
}) {
  const formData = new FormData();
  formData.set("action", "upload_document");
  formData.set("file", file);
  formData.set("kind", kind);

  return {
    formData: async () => formData,
  } as Request;
}

function makePdfFile(name: string) {
  return new File(["%PDF-1.7 test"], name, { type: "application/pdf" });
}

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status: 200,
    ...init,
  });
}
