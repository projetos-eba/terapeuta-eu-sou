export class EmailProviderError extends Error {
  constructor(
    readonly code: string,
    message = "Email provider request failed.",
    readonly status?: number,
    readonly retryable = false,
    readonly attemptCount = 1,
    readonly deliveryOutcome: "not_accepted" | "unknown" = "unknown",
  ) {
    super(message);
  }
}

export class EmailConfigurationError extends Error {
  constructor(message = "Transactional email configuration is incomplete.") {
    super(message);
  }
}

export class EmailSkippedError extends Error {
  constructor(readonly reason: string) {
    super("Transactional email was skipped.");
  }
}
