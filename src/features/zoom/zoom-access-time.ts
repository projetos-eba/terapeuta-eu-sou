import type { ZoomAccessState } from "@/domain/tes";

const ROOM_OPENING_LEAD_MS = 15 * 60_000;
const EARLY_ENTRY_CONFIRMATION_CUTOFF_MS = 60_000;

export function getZoomServerClockOffsetMs(
  access: Pick<ZoomAccessState, "serverNow"> | null,
) {
  if (!access?.serverNow) return 0;

  const serverNowMs = Date.parse(access.serverNow);
  return Number.isFinite(serverNowMs) ? serverNowMs - Date.now() : 0;
}

export function shouldConfirmTherapistEarlyRoomEntry(input: {
  access: Pick<
    ZoomAccessState,
    "allowed" | "availableFrom" | "scheduledStartsAt"
  >;
  serverNowMs: number;
}) {
  const { access, serverNowMs } = input;
  if (!access.allowed || !access.availableFrom || !access.scheduledStartsAt) {
    return false;
  }

  const availableFromMs = Date.parse(access.availableFrom);
  const scheduledStartsAtMs = Date.parse(access.scheduledStartsAt);
  if (
    !Number.isFinite(serverNowMs) ||
    !Number.isFinite(availableFromMs) ||
    !Number.isFinite(scheduledStartsAtMs)
  ) {
    return false;
  }

  const confirmationStartsAtMs = Math.max(
    availableFromMs,
    scheduledStartsAtMs - ROOM_OPENING_LEAD_MS,
  );
  const directEntryStartsAtMs =
    scheduledStartsAtMs - EARLY_ENTRY_CONFIRMATION_CUTOFF_MS;

  return (
    serverNowMs >= confirmationStartsAtMs && serverNowMs < directEntryStartsAtMs
  );
}

export function getTherapistDirectRoomEntryAtMs(
  access: Pick<ZoomAccessState, "scheduledStartsAt">,
) {
  if (!access.scheduledStartsAt) return null;

  const scheduledStartsAtMs = Date.parse(access.scheduledStartsAt);
  if (!Number.isFinite(scheduledStartsAtMs)) return null;

  return scheduledStartsAtMs - EARLY_ENTRY_CONFIRMATION_CUTOFF_MS;
}
