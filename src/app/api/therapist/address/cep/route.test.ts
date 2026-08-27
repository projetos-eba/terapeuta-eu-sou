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

import { GET } from "./route";

describe("therapist CEP route", () => {
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

    const response = await GET(makeRequest("13060-240"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it("accepts an authenticated patient session for the shared lookup", async () => {
    headerMocks.cookieGet.mockImplementation((name: string) =>
      name === "tes_patient_access_token"
        ? { value: "patient-token" }
        : undefined,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              localidade: "Campinas",
              logradouro: "Rua de teste",
              uf: "SP",
            }),
            { status: 200 },
          ),
        ),
    );

    const response = await GET(makeRequest("13060240"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        city: "Campinas",
        postalCode: "13060-240",
        state: "SP",
        street: "Rua de teste",
      },
      ok: true,
    });
  });

  it("rejects a CEP that does not contain eight digits", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(makeRequest("1306"));

    expect(response.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it("maps a valid ViaCEP response to the public contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              bairro: "Morumbi",
              cep: "13060-240",
              localidade: "Campinas",
              logradouro: "Rua de teste",
              uf: "SP",
            }),
            { status: 200 },
          ),
        ),
    );

    const response = await GET(makeRequest("13060240"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        city: "Campinas",
        neighborhood: "Morumbi",
        postalCode: "13060-240",
        state: "SP",
        street: "Rua de teste",
      },
      ok: true,
    });
  });

  it("keeps provider failures safe and actionable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
        .mockResolvedValueOnce(new Response(null, { status: 503 })),
    );

    const response = await GET(makeRequest("13060240"));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: { message: expect.not.stringContaining("viacep") },
      ok: false,
    });
  });
});

function makeRequest(cep: string) {
  return new Request(`https://tes.test/api/therapist/address/cep?cep=${cep}`);
}
