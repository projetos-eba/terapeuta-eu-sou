export function logZoomOperation(
  level: "error" | "info" | "warn",
  fields: Record<string, unknown>,
) {
  const safe = {
    actorRole: fields.actorRole,
    attempt: fields.attempt,
    bookingId: fields.bookingId,
    code: fields.code ?? "ZOOM_OPERATION",
    durationMs: fields.durationMs,
    jobId: fields.jobId,
    operation: fields.operation,
    provider: "zoom",
    requestId: fields.requestId,
    result: fields.result,
    status: fields.status,
  };
  const line = JSON.stringify(safe);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
