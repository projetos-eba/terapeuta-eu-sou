import { SupabaseRestClient } from "./supabase-rest.ts";
import type { EmailActionKey, UserRole } from "../email/types.ts";

export type AuthActionTokenClaim = {
  id: string;
  user_id: string;
  recipient_email: string;
  recipient_role: UserRole;
  expires_at: string;
};

export type EmailVerificationStatusTokenRow = {
  id: string;
  user_id: string;
  recipient_role: UserRole;
  expires_at: string;
  confirmed_at: string | null;
  revoked_at: string | null;
  profiles?: {
    email_confirmed_at?: string | null;
  } | null;
};

export async function createAuthActionToken(
  client: SupabaseRestClient,
  input: {
    expiresInSeconds: number;
    purpose: EmailActionKey;
    recipientEmail: string;
    recipientRole: UserRole;
    userId: string;
  },
) {
  const token = cryptoSafeToken();
  const tokenHash = await sha256Hex(token);

  await revokeAuthActionTokens(client, input.userId, input.purpose);
  await client.post(
    "/rest/v1/auth_action_tokens",
    {
      expires_at: new Date(
        Date.now() + input.expiresInSeconds * 1000,
      ).toISOString(),
      purpose: input.purpose,
      recipient_email: input.recipientEmail,
      recipient_role: input.recipientRole,
      token_hash: tokenHash,
      user_id: input.userId,
    },
    "return=minimal",
  );

  return { token, tokenHash };
}

export async function claimAuthActionToken(
  client: SupabaseRestClient,
  input: {
    purpose: EmailActionKey;
    token: string;
  },
) {
  const claimId = crypto.randomUUID();
  const tokenHash = await sha256Hex(input.token);
  const rows = await client.rpc<AuthActionTokenClaim[]>(
    "claim_auth_action_token",
    {
      p_claim_id: claimId,
      p_claim_lease_seconds: 120,
      p_purpose: input.purpose,
      p_token_hash: tokenHash,
    },
  );

  return rows[0] ? { claim: rows[0], claimId } : null;
}

export async function consumeAuthActionToken(
  client: SupabaseRestClient,
  tokenId: string,
  claimId: string,
) {
  return client.rpc<boolean>("consume_auth_action_token", {
    p_claim_id: claimId,
    p_token_id: tokenId,
  });
}

export async function releaseAuthActionTokenClaim(
  client: SupabaseRestClient,
  tokenId: string,
  claimId: string,
) {
  return client.rpc<boolean>("release_auth_action_token_claim", {
    p_claim_id: claimId,
    p_token_id: tokenId,
  });
}

export async function revokeAuthActionTokens(
  client: SupabaseRestClient,
  userId: string,
  purpose: EmailActionKey,
) {
  await client.patch(
    `/rest/v1/auth_action_tokens?user_id=eq.${encodeURIComponent(
      userId,
    )}&purpose=eq.${purpose}&consumed_at=is.null&revoked_at=is.null`,
    { revoked_at: new Date().toISOString() },
    "return=minimal",
  );
}

export async function createEmailVerificationStatusToken(
  client: SupabaseRestClient,
  input: {
    expiresInSeconds: number;
    recipientRole: UserRole;
    userId: string;
  },
) {
  const token = cryptoSafeToken();
  const tokenHash = await sha256Hex(token);

  await revokeEmailVerificationStatusTokens(client, input.userId);
  await client.post(
    "/rest/v1/email_verification_status_tokens",
    {
      expires_at: new Date(
        Date.now() + input.expiresInSeconds * 1000,
      ).toISOString(),
      recipient_role: input.recipientRole,
      token_hash: tokenHash,
      user_id: input.userId,
    },
    "return=minimal",
  );

  return { token, tokenHash };
}

export async function findEmailVerificationStatusToken(
  client: SupabaseRestClient,
  token: string,
) {
  const tokenHash = await sha256Hex(token);
  const rows = await client.get<EmailVerificationStatusTokenRow[]>(
    `/rest/v1/email_verification_status_tokens?select=id,user_id,recipient_role,expires_at,confirmed_at,revoked_at,profiles(email_confirmed_at)&token_hash=eq.${tokenHash}&expires_at=gt.${encodeURIComponent(
      new Date().toISOString(),
    )}&revoked_at=is.null&limit=1`,
  );

  return rows[0] ?? null;
}

export async function markEmailVerificationStatusConfirmed(
  client: SupabaseRestClient,
  tokenId: string,
) {
  await client.patch(
    `/rest/v1/email_verification_status_tokens?id=eq.${encodeURIComponent(
      tokenId,
    )}&confirmed_at=is.null`,
    { confirmed_at: new Date().toISOString() },
    "return=minimal",
  );
}

export async function revokeEmailVerificationStatusTokens(
  client: SupabaseRestClient,
  userId: string,
) {
  await client.patch(
    `/rest/v1/email_verification_status_tokens?user_id=eq.${encodeURIComponent(
      userId,
    )}&revoked_at=is.null`,
    { revoked_at: new Date().toISOString() },
    "return=minimal",
  );
}

export async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function cryptoSafeToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function base64Url(bytes: Uint8Array) {
  const binary = Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join("");
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
