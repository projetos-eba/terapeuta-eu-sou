import type { PatientAppointment } from "./patient-overview.types";

const LIVE_WINDOW_BEFORE_START_MS = 15 * 60 * 1000;

export function isPatientAppointmentLive(
  appointment: Pick<PatientAppointment, "endsAt" | "startsAt">,
  now: number | Date = Date.now(),
) {
  const startsAt = Date.parse(appointment.startsAt);
  const endsAt = Date.parse(appointment.endsAt);
  const nowTimestamp = now instanceof Date ? now.getTime() : now;

  if (
    !Number.isFinite(startsAt) ||
    !Number.isFinite(endsAt) ||
    !Number.isFinite(nowTimestamp) ||
    endsAt < startsAt
  ) {
    return false;
  }

  return (
    nowTimestamp >= startsAt - LIVE_WINDOW_BEFORE_START_MS &&
    nowTimestamp <= endsAt
  );
}
