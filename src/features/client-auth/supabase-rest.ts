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

type ClientLoginSession = {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  userId: string;
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
    if (error instanceof SupabaseFunctionError && error.status === 503) {
      throw new ClientAuthConfigError();
    }

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

  try {
    const session = await invokeSupabaseFunction<ClientLoginSession>(
      config,
      "client-auth-login",
      { body: input },
    );

    return {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      redirectTo: routes.patient.home,
      refreshToken: session.refreshToken,
      userId: session.userId,
    };
  } catch (error) {
    if (error instanceof SupabaseFunctionError && error.status === 409) {
      throw new ClientAuthEmailUnconfirmedError();
    }

    if (error instanceof SupabaseFunctionError && error.status === 403) {
      throw new ClientAuthRoleError();
    }

    if (error instanceof SupabaseFunctionError && error.status === 503) {
      throw new ClientAuthConfigError();
    }

    if (error instanceof SupabaseFunctionError) {
      throw new ClientAuthSupabaseError(error.status);
    }

    throw error;
  }
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
