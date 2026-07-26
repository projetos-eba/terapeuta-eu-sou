import { base64UrlEncode, hmacSha256Bytes } from "./crypto.ts";
import type { ZoomVideoSdkConfig } from "./config.ts";
import { ZoomVideoSdkError } from "./errors.ts";

export type ZoomVideoSdkRoleType = 0 | 1;

export type VideoSdkJwtClaims = {
  app_key: string;
  exp: number;
  iat: number;
  role_type: ZoomVideoSdkRoleType;
  session_key?: string;
  tpc: string;
  user_key?: string;
  version: 1;
};

export async function createVideoSdkJwt(input: {
  config: Pick<ZoomVideoSdkConfig, "sdkKey" | "sdkSecret">;
  now?: Date;
  roleType: ZoomVideoSdkRoleType;
  sessionKey?: string | null;
  sessionName: string;
  userKey: string;
}) {
  const sessionName = normalizeSessionName(input.sessionName);
  const userKey = normalizeUserKey(input.userKey);
  const sessionKey = input.sessionKey
    ? normalizeSessionKey(input.sessionKey)
    : undefined;
  const iat = Math.floor((input.now?.getTime() ?? Date.now()) / 1000) - 30;
  const exp = iat + 1800;
  const claims: VideoSdkJwtClaims = {
    app_key: input.config.sdkKey,
    exp,
    iat,
    role_type: input.roleType,
    tpc: sessionName,
    user_key: userKey,
    version: 1,
    ...(sessionKey ? { session_key: sessionKey } : {}),
  };

  return signJwt(claims, input.config.sdkSecret);
}

export async function signJwt(claims: Record<string, unknown>, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = base64UrlEncode(
    await hmacSha256Bytes(secret, signingInput),
  );

  return `${signingInput}.${signature}`;
}

export function normalizeSessionName(value: string) {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length < 1 ||
    normalized.length > 150 ||
    /[^\x20-\x7e]/.test(normalized) ||
    /["'`]/.test(normalized)
  ) {
    throw new ZoomVideoSdkError(
      "invalid_video_session_name",
      422,
      "Sessao de video invalida.",
    );
  }

  return normalized;
}

export function normalizeUserKey(value: string) {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9._:-]{8,36}$/.test(normalized)) {
    throw new ZoomVideoSdkError(
      "invalid_video_user_key",
      422,
      "Identidade de video invalida.",
    );
  }

  return normalized;
}

export function normalizeSessionKey(value: string) {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9._:-]{8,36}$/.test(normalized)) {
    throw new ZoomVideoSdkError(
      "invalid_video_session_key",
      422,
      "Chave de sessao de video invalida.",
    );
  }

  return normalized;
}
