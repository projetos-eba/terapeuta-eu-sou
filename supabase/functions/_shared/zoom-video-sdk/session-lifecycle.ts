import { ZoomVideoSdkError } from "./errors.ts";

export const ZOOM_VIDEO_MAX_DURATION = {
  maxMinutes: 240,
  minMinutes: 1,
} as const;

export const ZOOM_VIDEO_RECONNECT = {
  therapistGraceSeconds: 120,
} as const;

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
