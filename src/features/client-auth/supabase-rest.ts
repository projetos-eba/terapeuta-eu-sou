import "server-only";

import { routes } from "@/lib/routes";

import type { ClientSignupValue } from "./types";

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

type ProfileRow = {
  role: "admin" | "patient" | "therapist";
};

export function getClientSupabaseServerConfig(): SupabaseServerConfig | null {
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

export async function createClientAccount(value: ClientSignupValue) {
  const config = getClientSupabaseServerConfig();

  if (!config) {
    throw new ClientAuthConfigError();
  }

  let userId: string | null = null;

  try {
    const authUser = await createAuthUser(config, value);
    userId = authUser.id;

    await insertProfile(config, {
      displayName: value.name,
      email: value.email,
      phone: value.phoneDigits,
      userId,
    });

    await insertPatientProfile(config, userId, value);

    return { userId };
  } catch (error) {
    if (userId) {
      await deleteAuthUserBestEffort(config, userId);
    }

    throw error;
  }
}

export async function loginClientWithPassword(input: {
  email: string;
  password: string;
}) {
  const config = getClientSupabaseServerConfig();

  if (!config) {
    throw new ClientAuthConfigError();
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

  if (profile.role !== "patient") {
    throw new ClientAuthRoleError();
  }

  return {
    accessToken: session.access_token,
    expiresIn: session.expires_in ?? 3600,
    redirectTo: routes.patient.home,
    refreshToken: session.refresh_token,
    userId: session.user.id,
  };
}

async function createAuthUser(
  config: SupabaseServerConfig,
  value: ClientSignupValue,
) {
  return supabaseJson<SupabaseAuthUser>(config, "/auth/v1/admin/users", {
    apiKey: config.serviceRoleKey,
    body: {
      email: value.email,
      email_confirm: true,
      password: value.password,
      phone_confirm: false,
      user_metadata: {
        full_name: value.name,
        role: "patient",
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
      role: "patient",
    },
    method: "POST",
    prefer: "return=minimal",
  });
}

async function insertPatientProfile(
  config: SupabaseServerConfig,
  userId: string,
  value: ClientSignupValue,
) {
  const now = new Date().toISOString();

  return supabaseJson(config, "/rest/v1/patient_profiles", {
    apiKey: config.serviceRoleKey,
    body: {
      birth_date: value.birthDate,
      display_name: value.name,
      marketing_consent: false,
      metadata: {
        consent: {
          privacyAcceptedAt: now,
          termsAcceptedAt: now,
        },
        onboarding: {
          initialSignupAt: now,
          journeyRecommended: true,
          profileCanBeCompletedLater: true,
        },
        signup: {
          phoneDigits: value.phoneDigits,
          source: "client_auth",
        },
      },
      phone: value.phoneDigits,
      timezone: "America/Sao_Paulo",
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
    throw new ClientAuthRoleError();
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
    throw new ClientAuthSupabaseError(response.status);
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

export class ClientAuthConfigError extends Error {
  constructor() {
    super("Client auth Supabase configuration is missing.");
  }
}

export class ClientAuthRoleError extends Error {
  constructor() {
    super("Authenticated user is not a patient.");
  }
}

export class ClientAuthSupabaseError extends Error {
  constructor(readonly status: number) {
    super("Supabase client auth request failed.");
  }
}
