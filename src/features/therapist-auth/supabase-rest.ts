import "server-only";

import { TherapistPlan } from "@/domain/tes";
import {
  getSupabasePublicConfig,
  invokeSupabaseFunction,
  SupabaseFunctionError,
} from "@/lib/supabase/edge-functions";

import { getTherapistDashboardHref } from "./routing";
import type { TherapistSignupValue } from "./types";

type SupabaseServerConfig = {
  apiKey: string;
  url: string;
};

type TherapistLoginSession = {
  accessToken: string;
  expiresIn: number;
  plan: TherapistPlan;
  refreshToken: string;
  userId: string;
};

export type TherapistPasswordSession = {
  accessToken: string;
  expiresIn: number;
  plan: TherapistPlan;
  redirectTo: string;
  refreshToken: string;
  userId: string;
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
    return await invokeSupabaseFunction<{
      mode?: "automatically_confirmed" | "email_sent";
      redirectTo?: string;
      statusToken?: string;
      userId: string;
    }>(config, "therapist-auth-signup", { body: value });
  } catch (error) {
    if (error instanceof SupabaseFunctionError && error.status === 503) {
      throw new TherapistAuthConfigError();
    }

    if (error instanceof SupabaseFunctionError) {
      throw new TherapistAuthSupabaseError(error.status);
    }

    throw error;
  }
}

export async function loginTherapistWithPassword(input: {
  email: string;
  password: string;
}): Promise<TherapistPasswordSession> {
  const config = getSupabaseServerConfig();

  if (!config) {
    throw new TherapistAuthConfigError();
  }

  try {
    const session = await invokeSupabaseFunction<TherapistLoginSession>(
      config,
      "therapist-auth-login",
      { body: input },
    );

    return {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      plan: session.plan,
      redirectTo: getTherapistDashboardHref(session.plan),
      refreshToken: session.refreshToken,
      userId: session.userId,
    };
  } catch (error) {
    if (error instanceof SupabaseFunctionError && error.status === 409) {
      throw new TherapistAuthEmailUnconfirmedError();
    }

    if (error instanceof SupabaseFunctionError && error.status === 403) {
      throw new TherapistAuthRoleError();
    }

    if (error instanceof SupabaseFunctionError && error.status === 503) {
      throw new TherapistAuthConfigError();
    }

    if (error instanceof SupabaseFunctionError) {
      throw new TherapistAuthSupabaseError(error.status);
    }

    throw error;
  }
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

export class TherapistAuthEmailUnconfirmedError extends Error {
  constructor() {
    super("Therapist email is not confirmed.");
  }
}

export class TherapistAuthSupabaseError extends Error {
  constructor(
    readonly status: number,
    readonly safeDetails?: string,
  ) {
    super("Supabase therapist auth request failed.");
  }
}
