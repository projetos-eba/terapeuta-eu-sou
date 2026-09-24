const observationBlockedStatuses = new Set([
  "cancelled_by_patient",
  "cancelled_by_therapist",
  "refunded",
]);

export function isSessionObservationEligible(input: {
  bookingStatus: string;
  endsAt: string;
  now?: number;
}) {
  const endsAt = Date.parse(input.endsAt);
  const now = input.now ?? Date.now();

  return Number.isFinite(endsAt) &&
    endsAt <= now &&
    !observationBlockedStatuses.has(input.bookingStatus);
}
