import "server-only";

import {
  getSupabasePublicConfig,
  invokeSupabaseFunction,
  SupabaseFunctionError,
} from "@/lib/supabase/edge-functions";

import type { AdminLoginValue } from "./types";

type AdminLoginSession = {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  userId: string;
};

export type AdminPasswordSession = AdminLoginSession;

export async function loginAdminWithPassword(
  input: AdminLoginValue,
): Promise<AdminPasswordSession> {
  const config = getSupabasePublicConfig();

  if (!config) {
    throw new AdminAuthConfigError();
  }

  try {
    return await invokeSupabaseFunction<AdminLoginSession>(
      config,
      "admin-auth-login",
      { body: input },
    );
  } catch (error) {
    if (error instanceof SupabaseFunctionError && error.status === 409) {
      throw new AdminAuthEmailUnconfirmedError();
    }

    if (error instanceof SupabaseFunctionError && error.status === 403) {
      throw new AdminAuthRoleError();
    }

    if (error instanceof SupabaseFunctionError && error.status === 503) {
      throw new AdminAuthConfigError();
    }

    if (error instanceof SupabaseFunctionError) {
      throw new AdminAuthSupabaseError(error.status);
    }

    throw error;
  }
}

export class AdminAuthConfigError extends Error {
  constructor() {
    super("Admin auth Supabase configuration is missing.");
  }
}

export class AdminAuthRoleError extends Error {
  constructor() {
    super("Authenticated user is not an admin.");
  }
}

export class AdminAuthEmailUnconfirmedError extends Error {
  constructor() {
    super("Admin email is not confirmed.");
  }
}

export class AdminAuthSupabaseError extends Error {
  constructor(readonly status: number) {
    super("Supabase admin auth request failed.");
  }
}
