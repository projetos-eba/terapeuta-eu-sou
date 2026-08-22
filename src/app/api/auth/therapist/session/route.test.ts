import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieMocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  get: vi.fn(),
}));

const sessionMocks = vi.hoisted(() => ({
  getTherapistSessionSummary: vi.fn(),
  logoutTherapistSession: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookieMocks.cookies,
}));

vi.mock("@/features/therapist-auth/session-summary", () => sessionMocks);

import { DELETE, GET } from "./route";

describe("therapist public session route", () => {
  beforeEach(() => {
    cookieMocks.cookies.mockReset();
    cookieMocks.get.mockReset();
    sessionMocks.getTherapistSessionSummary.mockReset();
    sessionMocks.logoutTherapistSession.mockReset();
    cookieMocks.cookies.mockResolvedValue({ get: cookieMocks.get });
  });

  it("returns only the safe therapist summary", async () => {
    cookieMocks.get.mockReturnValue({ value: "therapist-access-token" });
    sessionMocks.getTherapistSessionSummary.mockResolvedValue({
      displayName: "Ana Oliveira",
    });

    const response = await GET();

    expect(await response.json()).toEqual({
      authenticated: true,
      therapist: { displayName: "Ana Oliveira" },
    });
    expect(sessionMocks.getTherapistSessionSummary).toHaveBeenCalledWith(
      "therapist-access-token",
    );
  });

  it("clears therapist cookies when the public menu logs out", async () => {
    cookieMocks.get.mockReturnValue({ value: "therapist-access-token" });

    const response = await DELETE();
    const setCookies = response.headers.getSetCookie().join("\n");

    expect(sessionMocks.logoutTherapistSession).toHaveBeenCalledWith(
      "therapist-access-token",
    );
    expect(setCookies).toContain("tes_therapist_access_token=");
    expect(setCookies).toContain("tes_therapist_refresh_token=");
    expect(setCookies).toContain("tes_therapist_plan=");
  });
});
