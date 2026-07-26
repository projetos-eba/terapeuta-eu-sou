import "server-only";

export type ServerOperationLog = {
  actorRole: "admin" | "patient" | "system" | "therapist";
  bookingId?: string;
  correlationId: string;
  durationMs: number;
  errorCode: string;
  externalStatus?: number | string;
  operation: string;
};

export function createCorrelationId() {
  return crypto.randomUUID();
}

export function logServerOperationFailure(fields: ServerOperationLog) {
  console.error(
    JSON.stringify({
      actor_role: fields.actorRole,
      booking_id: fields.bookingId,
      correlation_id: fields.correlationId,
      duration_ms: Math.max(0, Math.round(fields.durationMs)),
      error_code: fields.errorCode,
      external_status: fields.externalStatus,
      operation: fields.operation,
    }),
  );
}
