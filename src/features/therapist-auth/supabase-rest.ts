import "server-only";

import { TherapistPlan } from "@/domain/tes";
import { routes } from "@/lib/routes";
import {
  getSupabasePublicConfig,
  invokeSupabaseFunction,
  SupabaseFunctionError,
} from "@/lib/supabase/edge-functions";

import type { TherapistSignupValue } from "./types";

type SupabaseServerConfig = {
  apiKey: string;
  url: string;
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
  return getSupabasePublicConfig();
}

export async function createTherapistAccount(value: TherapistSignupValue) {
  const config = getSupabaseServerConfig();

  if (!config) {
    throw new TherapistAuthConfigError();
  }

  try {
    return await invokeSupabaseFunction<{ userId: string }>(
      config,
      "therapist-auth-signup",
      { body: value },
    );
  } catch (error) {
    if (error instanceof SupabaseFunctionError) {
      throw new TherapistAuthSupabaseError(error.status);
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
      apiKey: config.apiKey,
      body: {
        email: input.email,
        password: input.password,
      },
      method: "POST",
    },
  );

  const profile = await getProfile(
    config,
    session.user.id,
    session.access_token,
  );

  if (profile.role !== "therapist") {
    throw new TherapistAuthRoleError();
  }

  const therapistProfile = await getTherapistProfile(
    config,
    session.user.id,
    session.access_token,
  );

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

async function getProfile(
  config: SupabaseServerConfig,
  userId: string,
  accessToken: string,
) {
  const rows = await supabaseJson<ProfileRow[]>(
    config,
    `/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(userId)}&limit=1`,
    {
      apiKey: config.apiKey,
      bearerToken: accessToken,
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
  accessToken: string,
) {
  const rows = await supabaseJson<TherapistProfileRow[]>(
    config,
    `/rest/v1/therapist_profiles?select=plan&user_id=eq.${encodeURIComponent(
      userId,
    )}&limit=1`,
    {
      apiKey: config.apiKey,
      bearerToken: accessToken,
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
    bearerToken?: string;
    body?: unknown;
    method: "DELETE" | "GET" | "POST";
    prefer?: string;
  },
) {
  const bearerToken = options.bearerToken ?? options.apiKey;
  const response = await fetch(`${config.url}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    headers: {
      apikey: options.apiKey,
      Authorization: `Bearer ${bearerToken}`,
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
