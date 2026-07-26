import { ZoomRestClient } from "./client.ts";
import type { ZoomConfig } from "./types.ts";

export type ZoomUser = {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  status?: string;
  type?: number;
};

export function getZoomUser(config: ZoomConfig, userId: string) {
  return new ZoomRestClient(config).request<ZoomUser>(
    `/users/${encodeURIComponent(userId)}`,
  );
}
