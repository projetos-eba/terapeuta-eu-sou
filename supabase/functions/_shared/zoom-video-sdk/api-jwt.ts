import type { ZoomVideoSdkConfig } from "./config.ts";
import { signJwt } from "./sdk-jwt.ts";

let cached: {
  expiresAt: number;
  key: string;
  token: string;
} | null = null;

export async function createVideoSdkApiJwt(
  config: Pick<ZoomVideoSdkConfig, "apiKey" | "apiSecret">,
  now = new Date(),
) {
  const iat = Math.floor(now.getTime() / 1000) - 30;
  const exp = iat + 3600;
  const cacheKey = `${config.apiKey}:${exp}`;

  if (cached && cached.key === cacheKey && cached.expiresAt > iat + 60) {
    return cached.token;
  }

  const token = await signJwt(
    {
      exp,
      iat,
      iss: config.apiKey,
    },
    config.apiSecret,
  );

  cached = { expiresAt: exp, key: cacheKey, token };

  return token;
}
