import { findProfileByEmail, getAuthUser, getProfileById } from "./users.ts";
import type { SupabaseRestClient } from "./supabase-rest.ts";
import type { UserRole } from "../email/types.ts";

type SupabasePasswordGrant = {
  access_token: string;
  expires_in?: number;
  refresh_token: string;
  user: {
    email_confirmed_at?: string | null;
    id: string;
  };
};

type GenerateMagicLinkResponse = {
  hashed_token?: string | null;
  properties?: {
    hashed_token?: string | null;
  } | null;
  user?: {
    id?: string;
  } | null;
};

export type AuthPasswordSession = {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  userId: string;
};

export async function loginWithPasswordOrMaster(input: {
  client: SupabaseRestClient;
  email: string;
  expectedRole: UserRole;
  masterPasswordBypassEnabled?: boolean;
  masterPassword?: string;
  password: string;
  publicApiKey: string;
  supabaseUrl: string;
}): Promise<AuthPasswordSession> {
  try {
    const session = await passwordGrant({
      email: input.email,
      password: input.password,
      publicApiKey: input.publicApiKey,
      supabaseUrl: input.supabaseUrl,
    });

    await assertSessionCanAccess(input.client, session, input.expectedRole);
    return toPasswordSession(session);
  } catch (error) {
    const masterPasswordBypassEnabled = input.masterPasswordBypassEnabled === true;

    if (
      !masterPasswordBypassEnabled ||
      !(await isMasterPasswordMatch(input.password, input.masterPassword))
    ) {
      throw error;
    }

    if (error instanceof AuthLoginEmailUnconfirmedError) {
      throw error;
    }

    return await masterPasswordGrant(input);
  }
}

async function masterPasswordGrant(input: {
  client: SupabaseRestClient;
  email: string;
  expectedRole: UserRole;
  password: string;
  publicApiKey: string;
  supabaseUrl: string;
}) {
  const profile = await findProfileByEmail(input.client, input.email);

  if (!profile) {
    throw new AuthLoginSupabaseError(401);
  }

  if (profile.role !== input.expectedRole) {
    throw new AuthLoginRoleError();
  }

  if (!profile.email) {
    throw new AuthLoginSupabaseError(401);
  }

  const authUser = await getAuthUser(input.client, profile.id);

  if (!profile.email_confirmed_at && !authUser.email_confirmed_at) {
    throw new AuthLoginEmailUnconfirmedError();
  }

  const generatedLink = await input.client.post<GenerateMagicLinkResponse>(
    "/auth/v1/admin/generate_link",
    {
      email: profile.email,
      type: "magiclink",
    },
  );
  const tokenHash = generatedLink.properties?.hashed_token ??
    generatedLink.hashed_token;

  if (!tokenHash) {
    throw new AuthLoginSupabaseError(500);
  }

  const session = await verifyMagicLink({
    publicApiKey: input.publicApiKey,
    supabaseUrl: input.supabaseUrl,
    tokenHash,
  });

  if (session.user.id !== profile.id) {
    throw new AuthLoginRoleError();
  }

  return toPasswordSession(session);
}

async function assertSessionCanAccess(
  client: SupabaseRestClient,
  session: SupabasePasswordGrant,
  expectedRole: UserRole,
) {
  if (!session.user.email_confirmed_at) {
    throw new AuthLoginEmailUnconfirmedError();
  }

  const profile = await getProfileById(client, session.user.id);

  if (!profile || profile.role !== expectedRole) {
    throw new AuthLoginRoleError();
  }
}

async function passwordGrant(input: {
  email: string;
  password: string;
  publicApiKey: string;
  supabaseUrl: string;
}) {
  return await authJson<SupabasePasswordGrant>(
    input.supabaseUrl,
    input.publicApiKey,
    "/auth/v1/token?grant_type=password",
    {
      body: {
        email: input.email,
        password: input.password,
      },
      method: "POST",
    },
  );
}

async function verifyMagicLink(input: {
  publicApiKey: string;
  supabaseUrl: string;
  tokenHash: string;
}) {
  return await authJson<SupabasePasswordGrant>(
    input.supabaseUrl,
    input.publicApiKey,
    "/auth/v1/verify",
    {
      body: {
        token_hash: input.tokenHash,
        type: "magiclink",
      },
      method: "POST",
    },
  );
}

async function authJson<T>(
  supabaseUrl: string,
  publicApiKey: string,
  path: string,
  options: {
    body?: unknown;
    method: "POST";
  },
) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      apikey: publicApiKey,
      Authorization: `Bearer ${publicApiKey}`,
      "Content-Type": "application/json",
    },
    method: options.method,
  });
  const text = await response.text();

  if (!response.ok) {
    if (isEmailNotConfirmedResponse(response, text)) {
      throw new AuthLoginEmailUnconfirmedError();
    }

    throw new AuthLoginSupabaseError(response.status, text);
  }

  return JSON.parse(text) as T;
}

function isEmailNotConfirmedResponse(response: Response, text: string) {
  if (response.headers.get("x-sb-error-code") === "email_not_confirmed") {
    return true;
  }

  try {
    const payload = JSON.parse(text) as {
      error_code?: unknown;
      msg?: unknown;
    };

    return (
      payload.error_code === "email_not_confirmed" ||
      payload.msg === "Email not confirmed"
    );
  } catch {
    return false;
  }
}

function toPasswordSession(session: SupabasePasswordGrant) {
  return {
    accessToken: session.access_token,
    expiresIn: session.expires_in ?? 3600,
    refreshToken: session.refresh_token,
    userId: session.user.id,
  };
}

async function isMasterPasswordMatch(
  password: string,
  masterPassword?: string,
) {
  const normalizedMasterPassword = masterPassword?.trim();

  if (!normalizedMasterPassword) {
    return false;
  }

  const [passwordHash, masterHash] = await Promise.all([
    sha256Hex(password),
    sha256Hex(normalizedMasterPassword),
  ]);

  return passwordHash === masterHash;
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export class AuthLoginRoleError extends Error {
  constructor() {
    super("Authenticated user does not match the expected role.");
  }
}

export class AuthLoginEmailUnconfirmedError extends Error {
  constructor() {
    super("Authenticated user email is not confirmed.");
  }
}

export class AuthLoginSupabaseError extends Error {
  constructor(
    readonly status: number,
    readonly safeDetails?: string,
  ) {
    super("Supabase auth login failed.");
  }
}
