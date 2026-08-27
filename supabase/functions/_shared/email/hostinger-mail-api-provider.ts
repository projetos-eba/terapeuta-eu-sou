import { EmailProviderError } from "./errors.ts";
import type { EmailProvider } from "./provider.ts";
import type {
  EmailProviderSender,
  EmailProviderSendInput,
  EmailProviderSendResult,
} from "./types.ts";

type FetchLike = typeof fetch;

type HostingerProviderOptions = {
  apiKey: string;
  baseUrl?: string;
  fetcher?: FetchLike;
  maxAttempts?: number;
  timeoutMs?: number;
};

const DEFAULT_BASE_URL = "https://api.mail.hostinger.com";

export class HostingerMailApiProvider implements EmailProvider {
  private readonly baseUrl: string;
  private readonly fetcher: FetchLike;
  private readonly maxAttempts: number;
  private readonly timeoutMs: number;

  constructor(private readonly options: HostingerProviderOptions) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetcher = options.fetcher ?? fetch;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  async listSenders(): Promise<EmailProviderSender[]> {
    const response = await this.requestJson<unknown>("/api/v1/me", {
      method: "GET",
    });

    return parseSenderList(response.body);
  }

  async send(input: EmailProviderSendInput): Promise<EmailProviderSendResult> {
    const response = await this.requestJson<unknown>(
      `/api/v1/mailboxes/${encodeURIComponent(input.from.mailboxResourceId)}/send`,
      {
        body: {
          display_name: input.from.displayName,
          html: input.html,
          subject: input.subject,
          to: [input.to.email],
        },
        method: "POST",
      },
    );

    return {
      attemptCount: response.attemptCount,
      messageId: parseMessageId(response.body),
    };
  }

  private async requestJson<T>(
    path: string,
    options: {
      body?: unknown;
      method: "GET" | "POST";
    },
  ) {
    let attempt = 0;
    let lastError: EmailProviderError | null = null;

    while (attempt < this.maxAttempts) {
      attempt += 1;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
          const response = await this.fetcher(`${this.baseUrl}${path}`, {
            body: options.body ? JSON.stringify(options.body) : undefined,
            headers: {
              Authorization: `Bearer ${this.options.apiKey}`,
              "Content-Type": "application/json",
            },
            method: options.method,
            signal: controller.signal,
          });

          const parsedBody = await parseJsonSafely(response, response.ok);

          if (!response.ok) {
            const retryable = isRetryableStatus(response.status);
            const retryAfterMs = parseRetryAfter(response.headers);
            lastError = new EmailProviderError(
              providerCodeForStatus(response.status),
              "Email provider returned an error.",
              response.status,
              retryable,
              attempt,
              "not_accepted",
            );

            if (!retryable || attempt >= this.maxAttempts) {
              throw lastError;
            }

            await delay(retryAfterMs ?? backoffMs(attempt));
            continue;
          }

          return { attemptCount: attempt, body: parsedBody as T };
        } finally {
          clearTimeout(timeout);
        }
      } catch (error) {
        const providerError =
          error instanceof EmailProviderError
            ? error
            : new EmailProviderError(
                error instanceof DOMException && error.name === "AbortError"
                  ? "timeout"
                  : "network_error",
                "Email provider request failed.",
                undefined,
                false,
                attempt,
                "unknown",
              );

        lastError = providerError;

        if (!providerError.retryable || attempt >= this.maxAttempts) {
          throw providerError;
        }

        await delay(backoffMs(attempt));
      }
    }

    throw (
      lastError ??
      new EmailProviderError("provider_unavailable", "Email provider failed.")
    );
  }
}

async function parseJsonSafely(response: Response, requireJson: boolean) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    if (!requireJson) {
      return null;
    }

    throw new EmailProviderError(
      "invalid_json",
      "Email provider returned invalid JSON.",
      response.status,
      false,
    );
  }
}

function parseSenderList(value: unknown): EmailProviderSender[] {
  const candidates = collectObjects(value);
  const senders: EmailProviderSender[] = [];

  for (const item of candidates) {
    const mailboxResourceId = firstString(
      item,
      "mailboxResourceId",
      "mailbox_resource_id",
      "resourceId",
      "resource_id",
      "id",
    );
    const mailboxAddress = firstString(
      item,
      "mailboxAddress",
      "mailbox_address",
      "email",
      "address",
    );

    if (!mailboxResourceId || !mailboxAddress) {
      continue;
    }

    senders.push({
      displayName:
        firstString(item, "displayName", "display_name", "name") ??
        mailboxAddress,
      mailboxAddress,
      mailboxResourceId,
      replyToEmail: firstString(item, "replyToEmail", "reply_to_email"),
    });
  }

  return senders;
}

function collectObjects(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (!isRecord(value)) {
    return [];
  }

  for (const key of ["mailboxes", "senders", "resources"]) {
    const nested = value[key];
    if (Array.isArray(nested)) {
      return nested.filter(isRecord);
    }
  }

  const data = value.data;
  if (Array.isArray(data)) {
    return data.filter(isRecord);
  }

  if (isRecord(data)) {
    return collectObjects(data);
  }

  return [value];
}

function parseMessageId(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  return firstString(value, "messageId", "message_id", "id");
}

function firstString(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function providerCodeForStatus(status: number) {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 422) return "unprocessable";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "http_error";
}

function isRetryableStatus(status: number) {
  return status === 429 || status >= 500;
}

function parseRetryAfter(headers: Headers) {
  const raw = headers.get("retry-after");
  if (!raw) return null;

  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(date - Date.now(), 0) : null;
}

function backoffMs(attempt: number) {
  const base = Math.min(250 * 2 ** (attempt - 1), 2000);
  return base + Math.floor(Math.random() * 150);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
