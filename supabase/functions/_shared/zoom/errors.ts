export class ZoomError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
    message = "Nao foi possivel concluir a operacao Zoom.",
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export function sanitizeProviderMessage(value: unknown) {
  const raw = value instanceof Error ? value.message : String(value ?? "");

  return raw
    .replace(
      /(access_token|zak|client_secret|password|passcode|start_url|join_url)["'=:\s]+[^"',}\s]+/gi,
      "$1=REDACTED",
    )
    .replace(/https:\/\/[^\s"']+/gi, "URL_REDACTED")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 500);
}
