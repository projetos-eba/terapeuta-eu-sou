import "server-only";

import { TherapistPlan } from "@/domain/tes";
import { routes } from "@/lib/routes";

import type { TherapistSignupValue } from "./types";

const PLACEHOLDER_SUPABASE_URL = "https://your-project-ref.supabase.co";
const PLACEHOLDER_SUPABASE_ANON_KEY = "replace-with-supabase-anon-key";
const PLACEHOLDER_SERVICE_ROLE_KEY = "replace-with-supabase-service-role-key";

type SupabaseServerConfig = {
  anonKey: string;
  serviceRoleKey: string;
  url: string;
};

type SupabaseAuthUser = {
  id: string;
};

type SupabasePasswordGrant = {
  access_token: string;
  expires_in?: number;
  refresh_token: string;
  user: {
    id: string;
  };
};

type TherapistProfileRow = {
  plan: TherapistPlan;
};

type ProfileRow = {
  role: "admin" | "patient" | "therapist";
};

export function getSupabaseServerConfig(): SupabaseServerConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !url ||
    !anonKey ||
    !serviceRoleKey ||
    url === PLACEHOLDER_SUPABASE_URL ||
    anonKey === PLACEHOLDER_SUPABASE_ANON_KEY ||
    serviceRoleKey === PLACEHOLDER_SERVICE_ROLE_KEY
  ) {
    return null;
  }

  return {
    anonKey,
    serviceRoleKey,
    url: url.replace(/\/$/, ""),
  };
}

export async function createTherapistAccount(value: TherapistSignupValue) {
  const config = getSupabaseServerConfig();

  if (!config) {
    throw new TherapistAuthConfigError();
  }

  let userId: string | null = null;

  try {
    const authUser = await createAuthUser(config, value);
    userId = authUser.id;

    await insertProfile(config, {
      displayName: value.fullName,
      email: value.email,
      phone: value.phoneDigits,
      userId,
    });

    await insertTherapistProfile(config, userId, value);

    return { userId };
  } catch (error) {
    if (userId) {
      await deleteAuthUserBestEffort(config, userId);
    }

    throw error;
  }
}

export async function loginTherapistWithPassword(input: {
  email: string;
  password: string;
}) {
  const config = getSupabaseServerConfig();

  if (!config) {
    throw new TherapistAuthConfigError();
  }

  const session = await supabaseJson<SupabasePasswordGrant>(
    config,
    "/auth/v1/token?grant_type=password",
    {
      apiKey: config.anonKey,
      body: {
        email: input.email,
        password: input.password,
      },
      method: "POST",
    },
  );

  const profile = await getProfile(config, session.user.id);

  if (profile.role !== "therapist") {
    throw new TherapistAuthRoleError();
  }

  const therapistProfile = await getTherapistProfile(config, session.user.id);

  return {
    accessToken: session.access_token,
    expiresIn: session.expires_in ?? 3600,
    plan: therapistProfile.plan,
    redirectTo: getTherapistDashboardHref(therapistProfile.plan),
    refreshToken: session.refresh_token,
    userId: session.user.id,
  };
}

export function getTherapistDashboardHref(plan: TherapistPlan) {
  if (plan === TherapistPlan.Premium) {
    return routes.therapist.proHome;
  }

  if (plan === TherapistPlan.PremiumPlus) {
    return routes.therapist.plusHome;
  }

  return routes.therapist.basicHome;
}

async function createAuthUser(
  config: SupabaseServerConfig,
  value: TherapistSignupValue,
) {
  return supabaseJson<SupabaseAuthUser>(config, "/auth/v1/admin/users", {
    apiKey: config.serviceRoleKey,
    body: {
      email: value.email,
      email_confirm: true,
      password: value.password,
      phone_confirm: false,
      user_metadata: {
        full_name: value.fullName,
        requested_plan: value.plan,
        role: "therapist",
      },
    },
    method: "POST",
  });
}

async function deleteAuthUserBestEffort(
  config: SupabaseServerConfig,
  userId: string,
) {
  try {
    await supabaseJson(config, `/auth/v1/admin/users/${userId}`, {
      apiKey: config.serviceRoleKey,
      method: "DELETE",
    });
  } catch {
    // Best-effort cleanup only. The API response remains generic.
  }
}

async function insertProfile(
  config: SupabaseServerConfig,
  value: {
    displayName: string;
    email: string;
    phone: string;
    userId: string;
  },
) {
  return supabaseJson(config, "/rest/v1/profiles", {
    apiKey: config.serviceRoleKey,
    body: {
      display_name: value.displayName,
      email: value.email,
      id: value.userId,
      phone: value.phone,
      role: "therapist",
    },
    method: "POST",
    prefer: "return=minimal",
  });
}

async function insertTherapistProfile(
  config: SupabaseServerConfig,
  userId: string,
  value: TherapistSignupValue,
) {
  const now = new Date().toISOString();

  return supabaseJson(config, "/rest/v1/therapist_profiles", {
    apiKey: config.serviceRoleKey,
    body: {
      accepts_online_sessions: true,
      is_accepting_bookings: false,
      is_public: false,
      legal_name: value.fullName,
      metadata: {
        consent: {
          privacyAcceptedAt: now,
          termsAcceptedAt: now,
        },
        onboarding: {
          bankAccountRequiredForPayouts: true,
          documentsRequiredLater: true,
          initialSignupAt: now,
          publicProfileRecommended: true,
        },
        signup: {
          birthDate: value.birthDate,
          phoneDigits: value.phoneDigits,
          requestedPlan: value.plan,
          source: "therapist_auth",
        },
      },
      plan: value.plan,
      public_name: value.fullName,
      slug: buildUniqueSlug(value.fullName),
      status: "draft",
      user_id: userId,
    },
    method: "POST",
    prefer: "return=minimal",
  });
}

async function getProfile(config: SupabaseServerConfig, userId: string) {
  const rows = await supabaseJson<ProfileRow[]>(
    config,
    `/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(userId)}&limit=1`,
    {
      apiKey: config.serviceRoleKey,
      method: "GET",
    },
  );

  if (!rows[0]) {
    throw new TherapistAuthRoleError();
  }

  return rows[0];
}

async function getTherapistProfile(
  config: SupabaseServerConfig,
  userId: string,
) {
  const rows = await supabaseJson<TherapistProfileRow[]>(
    config,
    `/rest/v1/therapist_profiles?select=plan&user_id=eq.${encodeURIComponent(
      userId,
    )}&limit=1`,
    {
      apiKey: config.serviceRoleKey,
      method: "GET",
    },
  );

  if (!rows[0]) {
    throw new TherapistAuthRoleError();
  }

  return rows[0];
}

async function supabaseJson<T = unknown>(
  config: SupabaseServerConfig,
  path: string,
  options: {
    apiKey: string;
    body?: unknown;
    method: "DELETE" | "GET" | "POST";
    prefer?: string;
  },
) {
  const response = await fetch(`${config.url}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    headers: {
      apikey: options.apiKey,
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    method: options.method,
  });

  if (!response.ok) {
    throw new TherapistAuthSupabaseError(response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();

  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

function buildUniqueSlug(name: string) {
  const base =
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "terapeuta";
  const suffix = crypto.randomUUID().slice(0, 8);

  return `${base}-${suffix}`;
}

export class TherapistAuthConfigError extends Error {
  constructor() {
    super("Therapist auth Supabase configuration is missing.");
  }
}

export class TherapistAuthRoleError extends Error {
  constructor() {
    super("Authenticated user is not a therapist.");
  }
}

export class TherapistAuthSupabaseError extends Error {
  constructor(readonly status: number) {
    super("Supabase therapist auth request failed.");
  }
}
