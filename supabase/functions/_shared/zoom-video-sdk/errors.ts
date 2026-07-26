export class ZoomVideoSdkError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
    message = "Nao foi possivel concluir a operacao de video.",
  ) {
    super(message);
  }
}

export function sanitizeProviderMessage(error: unknown) {
  const raw =
    error instanceof Error ? error.message : String(error ?? "UNKNOWN");

  return raw
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(
      /(token|secret|signature|password)["'=:\s]+[^"',}\s]+/gi,
      "$1=[redacted]",
    )
    .replace(/[\r\n]+/g, " ")
    .slice(0, 500);
}
