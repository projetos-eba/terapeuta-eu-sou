import { base64UrlEncode, hmacSha256Base64Url } from "./crypto.ts";
import type { ZoomConfig } from "./types.ts";

export type MeetingSdkRole = 0 | 1;

export async function createMeetingSdkJwt(input: {
  config: ZoomConfig;
  meetingNumber: string;
  role: MeetingSdkRole;
  nowSeconds?: number;
}) {
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const iat = now - 30;
  const exp = now + 60 * 60 * 2;
  const payload = {
    appKey: input.config.meetingSdkClientId,
    exp,
    iat,
    mn: input.meetingNumber,
    role: input.role,
    sdkKey: input.config.meetingSdkClientId,
    tokenExp: exp,
  };
  const encodedHeader = base64UrlEncode(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  );
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await hmacSha256Base64Url(
    input.config.meetingSdkClientSecret,
    signingInput,
  );

  return `${signingInput}.${signature}`;
}

export function normalizeMeetingSdkRole(
  value: "patient" | "therapist",
): MeetingSdkRole {
  return value === "therapist" ? 1 : 0;
}
