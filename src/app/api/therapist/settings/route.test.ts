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

import { PATCH } from "./route";

const userId = "c1000000-0000-4000-8000-000000000001";

describe("therapist settings route", () => {
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

    const response = await PATCH(
      makeRequest({
        displayName: "Ana Oliveira",
        phone: "",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.message).toBe("Entre na sua conta para continuar.");
  });

  it("rejects invalid payloads before calling Supabase", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await PATCH(
      makeRequest({
        displayName: "A",
        phone: "+55 11 99999-9999",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the CPF validity message before calling Supabase", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await PATCH(
      makeRequest({
        ...validSettingsPayload(),
        identity: {
          ...validSettingsPayload().identity,
          documentNumber: "11111111111",
        },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error).toEqual({
      code: "VALIDATION_ERROR",
      message: "Não foi possível concluir a operação, o CPF não é válido.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects authenticated non-therapist users", async () => {
    vi.stubGlobal("fetch", makeFetchMock({ role: "patient" }));

    const response = await PATCH(
      makeRequest({
        displayName: "Ana Oliveira",
        phone: "",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe("FORBIDDEN");
  });

  it("updates only account-facing profile columns for therapists", async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const response = await PATCH(
      makeRequest({
        displayName: "  Ana Oliveira  ",
        phone: "  +55 11 99999-9999  ",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.account).toEqual({
      displayName: "Ana Oliveira",
      phone: "+55 11 99999-9999",
      identity: {
        city: "",
        complement: "",
        documentNumber: "",
        documentType: "cpf",
        neighborhood: "",
        postalCode: "",
        state: "",
        street: "",
        streetNumber: "",
      },
    });

    const patchCall = fetchMock.mock.calls.find(([url, init]) => {
      return (
        String(url).includes("/rest/v1/profiles?") && init?.method === "PATCH"
      );
    });
    expect(patchCall).toBeTruthy();
    expect(String(patchCall?.[0])).toContain(`id=eq.${userId}`);
    expect(String(patchCall?.[0])).toContain("role=eq.therapist");
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
      display_name: "Ana Oliveira",
      phone: "+55 11 99999-9999",
    });
  });

  it("maps an already used CPF to a safe conflict response", async () => {
    const fetchMock = makeFetchMock({ identityError: "CPF_ALREADY_IN_USE" });
    vi.stubGlobal("fetch", fetchMock);

    const response = await PATCH(makeRequest(validSettingsPayload()));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toEqual({
      code: "CPF_IN_USE",
      message: "Este documento já está em uso em outra conta.",
    });
  });
});

function validSettingsPayload() {
  return {
    displayName: "Ana Oliveira",
    identity: {
      city: "São Paulo",
      complement: "",
      documentNumber: "52998224725",
      documentType: "cpf",
      neighborhood: "Pinheiros",
      postalCode: "05409-000",
      state: "SP",
      street: "Rua dos Pinheiros",
      streetNumber: "100",
    },
    phone: "",
  };
}

function makeRequest(body: unknown) {
  return new Request("https://tes.example.test/api/therapist/settings", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
}

function makeFetchMock({
  identityError,
  role = "therapist",
}: {
  identityError?: "CPF_ALREADY_IN_USE";
  role?: string;
} = {}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.includes("/auth/v1/user")) {
      return jsonResponse({ id: userId });
    }

    if (url.includes("/rest/v1/profiles?") && init?.method !== "PATCH") {
      return jsonResponse([{ role }]);
    }

    if (url.includes("/rest/v1/profiles?") && init?.method === "PATCH") {
      return jsonResponse([
        {
          display_name: "Ana Oliveira",
          phone: "+55 11 99999-9999",
        },
      ]);
    }

    if (url.includes("save_therapist_private_identity_v1")) {
      if (identityError) {
        return jsonResponse(
          { code: "23505", message: identityError },
          { status: 409 },
        );
      }
      return jsonResponse({});
    }

    return new Response(null, { status: 404 });
  });
}

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status: 200,
    ...init,
  });
}
