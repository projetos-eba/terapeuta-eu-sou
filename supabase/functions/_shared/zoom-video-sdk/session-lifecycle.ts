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
  afterEndsMinutes: number;
  maxDurationMinutes: number;
  now?: Date;
  scheduledEndsAt: string;
  scheduledStartsAt: string;
}) {
  const now = input.now ?? new Date();
  const scheduledStartsAt = new Date(input.scheduledStartsAt);
  const scheduledEndsAt = new Date(input.scheduledEndsAt);
  const actualStartedAt = input.actualStartedAt
    ? new Date(input.actualStartedAt)
    : now;
  const effectiveStart = new Date(
    Math.max(scheduledStartsAt.getTime(), actualStartedAt.getTime()),
  );
  const maxDurationEnd = new Date(
    effectiveStart.getTime() + input.maxDurationMinutes * 60_000,
  );
  const toleratedScheduledEnd = new Date(
    scheduledEndsAt.getTime() + input.afterEndsMinutes * 60_000,
  );

  return new Date(
    Math.min(maxDurationEnd.getTime(), toleratedScheduledEnd.getTime()),
  );
}
