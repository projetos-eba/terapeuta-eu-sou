import { beforeEach, describe, expect, it, vi } from "vitest";

import { TherapistPlan, TherapistStatus } from "@/domain/tes";
import { routes } from "@/lib/routes";

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
    get: () => (mocks.accessToken ? { value: mocks.accessToken } : undefined),
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
  isBlockedTherapistStatus,
  requireTherapistSession,
  shouldRedirectTherapistPlan,
} from "./therapist-session";

describe("requireTherapistSession", () => {
  beforeEach(() => {
    mocks.accessToken = "valid-token";
    mocks.redirect.mockClear();
    mockSupabaseSession();
  });

  it("returns the authenticated therapist from the access token", async () => {
    await expect(requireTherapistSession()).resolves.toMatchObject({
      name: "Ana Oliveira",
      plan: TherapistPlan.PremiumPlus,
      profileId: "therapist-1",
      userId: "user-1",
    });
  });

  it("redirects when the access token is absent", async () => {
    mocks.accessToken = undefined;
    await expect(requireTherapistSession()).rejects.toThrow("/terapeuta/login");
  });

  it("preserves a safe checkout continuation when login is required", async () => {
    mocks.accessToken = undefined;

    await expect(
      requireTherapistSession({
        loginContinuation: "/terapeuta/checkout?plan=premium",
      }),
    ).rejects.toThrow(
      "/terapeuta/login?next=%2Fterapeuta%2Fcheckout%3Fplan%3Dpremium",
    );
  });

  it("enforces capability without deriving access from a namespace", async () => {
    mockSupabaseSession({ plan: TherapistPlan.Premium });

    await expect(
      requireTherapistSession({ capability: "aura_full" }),
    ).rejects.toThrow(routes.therapist.home);
  });

  it("rejects a non-therapist profile", async () => {
    mockSupabaseSession({ role: "patient" });

    await expect(requireTherapistSession()).rejects.toThrow(
      routes.public.therapistSignIn,
    );
  });
});

describe("therapist session policy", () => {
  it("keeps every plan in the same namespace", () => {
    expect(shouldRedirectTherapistPlan(TherapistPlan.Free, {})).toBe(false);
    expect(shouldRedirectTherapistPlan(TherapistPlan.Premium, {})).toBe(false);
    expect(shouldRedirectTherapistPlan(TherapistPlan.PremiumPlus, {})).toBe(
      false,
    );
  });

  it("enforces minimum plan and capability gates", () => {
    expect(
      shouldRedirectTherapistPlan(TherapistPlan.Free, {
        minimumPlan: TherapistPlan.Premium,
      }),
    ).toBe(true);
    expect(
      shouldRedirectTherapistPlan(TherapistPlan.Premium, {
        capability: "aura_full",
      }),
    ).toBe(true);
    expect(
      shouldRedirectTherapistPlan(TherapistPlan.PremiumPlus, {
        capability: "aura_full",
      }),
    ).toBe(false);
  });

  it("blocks suspended and rejected statuses", () => {
    expect(isBlockedTherapistStatus(TherapistStatus.Suspended)).toBe(true);
    expect(isBlockedTherapistStatus(TherapistStatus.Rejected)).toBe(true);
    expect(isBlockedTherapistStatus(TherapistStatus.Approved)).toBe(false);
  });
});

function mockSupabaseSession({
  plan = TherapistPlan.PremiumPlus,
  role = "therapist",
  status = TherapistStatus.Approved,
}: {
  plan?: TherapistPlan;
  role?: "admin" | "patient" | "therapist";
  status?: TherapistStatus;
} = {}) {
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
            role,
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: "therapist-1",
            photo_url: "/ana.png",
            plan,
            public_name: "Ana Oliveira",
            status,
            user_id: "user-1",
          },
        ]),
      ),
  );
}

function jsonResponse(value: unknown) {
  return {
    json: async () => value,
    ok: true,
  } as Response;
}
