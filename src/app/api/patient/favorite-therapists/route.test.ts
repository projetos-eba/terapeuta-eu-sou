import { beforeEach, describe, expect, it, vi } from "vitest";

const patientSessionMocks = vi.hoisted(() => ({
  getPatientAccessToken: vi.fn(),
}));
const configMocks = vi.hoisted(() => ({
  getSupabasePublicConfig: vi.fn(),
}));

vi.mock("@/lib/auth/patient-session", () => ({
  getPatientAccessToken: patientSessionMocks.getPatientAccessToken,
}));
vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: configMocks.getSupabasePublicConfig,
}));

import { DELETE, GET, POST } from "./route";

const patientProfileId = "a1000000-0000-4000-8000-000000000001";
const therapistProfileId = "b1000000-0000-4000-8000-000000000001";
const userId = "c1000000-0000-4000-8000-000000000001";

describe("patient favorite therapists route", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    patientSessionMocks.getPatientAccessToken.mockReset();
    configMocks.getSupabasePublicConfig.mockReset();
    patientSessionMocks.getPatientAccessToken.mockResolvedValue(
      "patient-token",
    );
    configMocks.getSupabasePublicConfig.mockReturnValue({
      apiKey: "publishable-key",
      url: "https://tes.supabase.test",
    });
  });

  it("requires a patient session before reading favorite state", async () => {
    patientSessionMocks.getPatientAccessToken.mockResolvedValue(null);

    const response = await GET(
      new Request(
        `https://tes.example.test/api/patient/favorite-therapists?therapistProfileId=${therapistProfileId}`,
      ),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { message: "Entre na sua conta." },
      ok: false,
    });
  });

  it("rejects an invalid therapist identifier before querying Supabase", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request(
        "https://tes.example.test/api/patient/favorite-therapists?therapistProfileId=invalid",
      ),
    );

    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads only the authenticated patient's favorite state", async () => {
    const fetchMock = createFetchMock({ favoriteRows: [{ id: "favorite-1" }] });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request(
        `https://tes.example.test/api/patient/favorite-therapists?therapistProfileId=${therapistProfileId}`,
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      isFavorite: true,
      ok: true,
    });
    const stateRead = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/rest/v1/favorite_therapists?select=id"),
    );
    expect(String(stateRead?.[0])).toContain(
      `patient_profile_id=eq.${patientProfileId}`,
    );
    expect(String(stateRead?.[0])).toContain(
      `therapist_profile_id=eq.${therapistProfileId}`,
    );
  });

  it("adds idempotently using the patient profile resolved from the access token", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      requestWithProfile("POST", {
        patientProfileId: "other-patient-must-be-ignored",
        therapistProfileId,
      }),
    );

    expect(response.status).toBe(200);
    const mutation = fetchMock.mock.calls.find(
      ([, init]) => init?.method === "POST",
    );
    expect(JSON.parse(String(mutation?.[1]?.body))).toEqual({
      patient_profile_id: patientProfileId,
      therapist_profile_id: therapistProfileId,
    });
    expect(mutation?.[1]?.headers).toMatchObject({
      Prefer: "resolution=merge-duplicates,return=minimal",
    });
  });

  it("removes only the authenticated patient's matching favorite", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const response = await DELETE(
      requestWithProfile("DELETE", { therapistProfileId }),
    );

    expect(response.status).toBe(200);
    const mutation = fetchMock.mock.calls.find(
      ([, init]) => init?.method === "DELETE",
    );
    expect(String(mutation?.[0])).toContain(
      `patient_profile_id=eq.${patientProfileId}`,
    );
    expect(String(mutation?.[0])).toContain(
      `therapist_profile_id=eq.${therapistProfileId}`,
    );
  });
});

function requestWithProfile(method: "DELETE" | "POST", body: unknown) {
  return new Request(
    "https://tes.example.test/api/patient/favorite-therapists",
    {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method,
    },
  );
}

function createFetchMock({
  favoriteRows = [],
}: { favoriteRows?: unknown[] } = {}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.includes("/auth/v1/user")) return jsonResponse({ id: userId });
    if (url.includes("/rest/v1/patient_profiles")) {
      return jsonResponse([{ id: patientProfileId }]);
    }
    if (url.includes("/rest/v1/favorite_therapists") && !init?.method) {
      return jsonResponse(favoriteRows);
    }
    if (url.includes("/rest/v1/favorite_therapists")) {
      return new Response(null, { status: 201 });
    }

    return new Response(null, { status: 404 });
  });
}

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}
