import { beforeEach, describe, expect, it, vi } from "vitest";

const headerMocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: headerMocks.cookies,
}));

import { GET } from "./route";

describe("therapist metrics export route", () => {
  beforeEach(() => {
    headerMocks.cookieGet.mockReset();
    headerMocks.cookies.mockReset();
    headerMocks.cookies.mockResolvedValue({ get: headerMocks.cookieGet });
  });

  it("rejects unsupported tabs and periods before reading the session", async () => {
    const response = await GET(
      new Request(
        "https://tes.example.test/api/therapist/metrics/export?tab=aura&period=180",
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(headerMocks.cookies).not.toHaveBeenCalled();
  });

  it("requires the authenticated therapist cookie", async () => {
    headerMocks.cookieGet.mockReturnValue(undefined);

    const response = await GET(
      new Request(
        "https://tes.example.test/api/therapist/metrics/export?tab=sessions&period=30",
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("SESSION_EXPIRED");
    expect(payload.error.message).not.toContain("Supabase");
    expect(response.headers.get("x-correlation-id")).toBeTruthy();
  });
});
