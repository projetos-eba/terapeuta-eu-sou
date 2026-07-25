import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  canUseTherapistCapability,
  isTherapistPlanAtLeast,
  TherapistPlan,
  TherapistStatus,
  type TherapistCapability,
  type TherapistStatus as TherapistStatusValue,
} from "@/domain/tes";
import {
  getTherapistDashboardHref,
  getTherapistLoginHref,
} from "@/features/therapist-auth/routing";
import { routes } from "@/lib/routes";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

export type RequireTherapistSessionOptions = {
  capability?: TherapistCapability;
  loginContinuation?: string;
  minimumPlan?: TherapistPlan;
};

type SupabaseAuthUser = {
  id: string;
};

type ProfileRow = {
  avatar_url: string | null;
  display_name: string | null;
  id: string;
  role: "admin" | "patient" | "therapist";
};

type TherapistProfileRow = {
  id: string;
  photo_url: string | null;
  plan: TherapistPlan;
  public_name: string;
  status: TherapistStatusValue;
  user_id: string;
};

export type AuthenticatedTherapistSession = {
  accessToken: string;
  avatarUrl: string | null;
  name: string;
  plan: TherapistPlan;
  profileId: string;
  status: TherapistStatusValue;
  userId: string;
};

export async function requireTherapistSession(
  options: RequireTherapistSessionOptions = {},
): Promise<AuthenticatedTherapistSession> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_therapist_access_token")?.value;
  const config = getSupabasePublicConfig();

  if (!accessToken || !config) {
    redirect(getTherapistLoginHref(options.loginContinuation));
  }

  try {
    const user = await requestSupabase<SupabaseAuthUser>(
      config,
      "/auth/v1/user",
      accessToken,
    );
    const [profiles, therapistProfiles] = await Promise.all([
      requestSupabase<ProfileRow[]>(
        config,
        `/rest/v1/profiles?select=id,display_name,avatar_url,role&id=eq.${encodeURIComponent(user.id)}&limit=1`,
        accessToken,
      ),
      requestSupabase<TherapistProfileRow[]>(
        config,
        `/rest/v1/therapist_profiles?select=id,user_id,plan,status,public_name,photo_url&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
        accessToken,
      ),
    ]);
    const profile = profiles[0];
    const therapistProfile = therapistProfiles[0];

    if (!profile || profile.role !== "therapist" || !therapistProfile) {
      redirect(routes.public.therapistSignIn);
    }

    if (isBlockedTherapistStatus(therapistProfile.status)) {
      redirect(
        `${routes.public.therapistSignIn}?reason=${therapistProfile.status}`,
      );
    }

    enforceTherapistRoutePolicy(therapistProfile.plan, options);

    return {
      accessToken,
      avatarUrl: therapistProfile.photo_url ?? profile.avatar_url,
      name: therapistProfile.public_name || profile.display_name || "Terapeuta",
      plan: therapistProfile.plan,
      profileId: therapistProfile.id,
      status: therapistProfile.status,
      userId: user.id,
    };
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    redirect(getTherapistLoginHref(options.loginContinuation));
  }
}

export function isBlockedTherapistStatus(status: TherapistStatusValue) {
  return (
    status === TherapistStatus.Suspended || status === TherapistStatus.Rejected
  );
}

export function shouldRedirectTherapistPlan(
  plan: TherapistPlan,
  options: RequireTherapistSessionOptions,
) {
  if (
    options.minimumPlan &&
    !isTherapistPlanAtLeast(plan, options.minimumPlan)
  ) {
    return true;
  }

  return Boolean(
    options.capability && !canUseTherapistCapability(plan, options.capability),
  );
}

function enforceTherapistRoutePolicy(
  plan: TherapistPlan,
  options: RequireTherapistSessionOptions,
) {
  if (shouldRedirectTherapistPlan(plan, options)) {
    redirect(getTherapistDashboardHref(plan));
  }
}

async function requestSupabase<T>(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  path: string,
  accessToken: string,
): Promise<T> {
  const response = await fetch(`${config.url}${path}`, {
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) throw new Error("Therapist session is invalid");
  return (await response.json()) as T;
}

function isNextRedirect(error: unknown) {
  return (
    error instanceof Error &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  );
}
