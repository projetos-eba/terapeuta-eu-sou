import { ZoomVideoSdkError } from "./errors.ts";

export const ZOOM_VIDEO_MAX_DURATION = {
  maxMinutes: 240,
  minMinutes: 1,
} as const;

export const ZOOM_VIDEO_RECONNECT = {
  therapistGraceSeconds: 120,
} as const;

// Written exclusively by the trusted provider-event RPC; never a browser claim.
export function hasConfirmedProviderClosure(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return false;
  const value = metadata as Record<string, unknown>;
  return (
    typeof value.zoom_provider_closed_at === "string" &&
    Number.isFinite(Date.parse(value.zoom_provider_closed_at)) &&
    Array.isArray(value.zoom_closed_provider_hashes) &&
    value.zoom_closed_provider_hashes.some(
      (hash) => typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash),
    )
  );
}

export type ZoomVideoLifecycleConfig = {
  maxDurationMinutes: number;
  therapistReconnectGraceSeconds: number;
};

export function parseZoomVideoMaxDurationMinutes(
  value: string | undefined,
): number {
  const normalized = value?.trim();
  if (!normalized || !/^[1-9][0-9]*$/.test(normalized)) {
    throw new ZoomVideoSdkError(
      "invalid_zoom_video_session_max_duration_minutes",
      503,
      "Configuracao Zoom Video SDK invalida.",
    );
  }

  const minutes = Number(normalized);
  if (
    !Number.isSafeInteger(minutes) ||
    minutes < ZOOM_VIDEO_MAX_DURATION.minMinutes ||
    minutes > ZOOM_VIDEO_MAX_DURATION.maxMinutes
  ) {
    throw new ZoomVideoSdkError(
      "invalid_zoom_video_session_max_duration_minutes",
      503,
      "Configuracao Zoom Video SDK invalida.",
    );
  }

  return minutes;
}

export function computeVideoSessionHardEndsAt(input: {
  actualStartedAt?: string | null;
  maxDurationMinutes: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const actualStartedAt = input.actualStartedAt
    ? new Date(input.actualStartedAt)
    : now;
  return new Date(
    actualStartedAt.getTime() + input.maxDurationMinutes * 60_000,
  );
}
