import "server-only";

import { routes } from "@/lib/routes";
import {
  getSupabasePublicConfig,
  invokeSupabaseFunction,
  SupabaseFunctionError,
} from "@/lib/supabase/edge-functions";

import type { ClientSignupValue } from "./types";

type SupabaseServerConfig = {
  apiKey: string;
  url: string;
};

type SupabasePasswordGrant = {
  access_token: string;
  expires_in?: number;
  refresh_token: string;
  user: {
    email_confirmed_at?: string | null;
    id: string;
  };
};

type ProfileRow = {
  role: "admin" | "patient" | "therapist";
};

export function getClientSupabaseServerConfig(): SupabaseServerConfig | null {
  return getSupabasePublicConfig();
}

export async function createClientAccount(value: ClientSignupValue) {
  const config = getClientSupabaseServerConfig();

  if (!config) {
    throw new ClientAuthConfigError();
  }

  try {
    return await invokeSupabaseFunction<{
      mode?: "automatically_confirmed" | "email_sent";
      redirectTo?: string;
      statusToken?: string;
      userId: string;
    }>(config, "client-auth-signup", { body: value });
  } catch (error) {
    if (error instanceof SupabaseFunctionError) {
      throw new ClientAuthSupabaseError(error.status);
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

  let session: SupabasePasswordGrant;

  try {
    session = await supabaseJson<SupabasePasswordGrant>(
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
  } catch (error) {
    if (
      error instanceof ClientAuthSupabaseError &&
      /confirm/i.test(error.safeDetails ?? "")
    ) {
      throw new ClientAuthEmailUnconfirmedError();
    }

    throw error;
  }

  if (!session.user.email_confirmed_at) {
    throw new ClientAuthEmailUnconfirmedError();
  }

  const profile = await getProfile(
    config,
    session.user.id,
    session.access_token,
  );

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
    bearerToken?: string;
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
    throw new ClientAuthSupabaseError(response.status, await response.text());
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

export class ClientAuthEmailUnconfirmedError extends Error {
  constructor() {
    super("Client email is not confirmed.");
  }
}

export class ClientAuthSupabaseError extends Error {
  constructor(
    readonly status: number,
    readonly safeDetails?: string,
  ) {
    super("Supabase client auth request failed.");
  }
}
