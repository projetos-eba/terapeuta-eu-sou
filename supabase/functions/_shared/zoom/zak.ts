import { ZoomRestClient } from "./client.ts";
import type { ZoomConfig } from "./types.ts";

type ZakResponse = {
  token?: string;
};

export async function getZoomZak(config: ZoomConfig, userId: string) {
  const response = await new ZoomRestClient(config).request<ZakResponse>(
    `/users/${encodeURIComponent(userId)}/token?type=zak`,
  );

  return response.token ?? null;
}
