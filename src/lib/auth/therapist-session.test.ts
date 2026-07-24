import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  TherapistPlan,
  TherapistStatus,
} from "@/domain/tes";

const mocks = vi.hoisted(() => ({
  accessToken: "valid-token" as string | undefined,
  redirect: vi.fn((href: string) => {
    const error = new Error(href) as Error & { digest: string };
    error.digest = `NEXT_REDIRECT;${href}`;
    throw error;
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: () =>
      mocks.accessToken ? { value: mocks.accessToken } : undefined,
  }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: () => ({
    apiKey: "publishable-key",
    url: "http://supabase.test",
  }),
}));

import {
  getTherapistNamespace,
  isBlockedTherapistStatus,
  requireTherapistSession,
  shouldRedirectTherapistPlan,
} from "./therapist-session";

describe("requireTherapistSession", () => {
  beforeEach(() => {
    mocks.accessToken = "valid-token";
    mocks.redirect.mockClear();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ id: "user-1" }))
        .mockResolvedValueOnce(
          jsonResponse([
            {
              avatar_url: "/ana.png",
              display_name: "Ana Oliveira",
              id: "user-1",
              role: "therapist",
            },
          ]),
        )
        .mockResolvedValueOnce(
          jsonResponse([
            {
              id: "therapist-1",
              photo_url: "/ana.png",
              plan: TherapistPlan.PremiumPlus,
              public_name: "Ana Oliveira",
              status: TherapistStatus.Approved,
              user_id: "user-1",
            },
          ]),
        ),
    );
  });

  it("returns the authenticated therapist from the access token", async () => {
    await expect(
      requireTherapistSession({ namespace: "plus" }),
    ).resolves.toMatchObject({
      name: "Ana Oliveira",
      plan: TherapistPlan.PremiumPlus,
      profileId: "therapist-1",
      userId: "user-1",
    });
  });

  it("redirects when the access token is absent", async () => {
    mocks.accessToken = undefined;
    await expect(requireTherapistSession()).rejects.toThrow(
      "/terapeuta/login",
    );
  });
});

describe("therapist session policy", () => {
  it("maps every plan to its canonical namespace", () => {
    expect(getTherapistNamespace(TherapistPlan.Free)).toBe("basico");
    expect(getTherapistNamespace(TherapistPlan.Premium)).toBe("pro");
    expect(getTherapistNamespace(TherapistPlan.PremiumPlus)).toBe("plus");
  });

  it("redirects Premium away from the Plus namespace", () => {
    expect(
      shouldRedirectTherapistPlan(TherapistPlan.Premium, {
        namespace: "plus",
      }),
    ).toBe(true);
  });

  it("blocks suspended and rejected statuses", () => {
    expect(isBlockedTherapistStatus(TherapistStatus.Suspended)).toBe(true);
    expect(isBlockedTherapistStatus(TherapistStatus.Rejected)).toBe(true);
    expect(isBlockedTherapistStatus(TherapistStatus.Approved)).toBe(false);
  });
});

function jsonResponse(value: unknown) {
  return {
    json: async () => value,
    ok: true,
  } as Response;
}
