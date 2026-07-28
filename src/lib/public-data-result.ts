import "server-only";

import { randomUUID } from "node:crypto";

export type PublicDataDegradedReason =
  | "configuration_missing"
  | "invalid_response"
  | "query_failed"
  | "timeout";

export type PublicDataResult<T> =
  | {
      data: T;
      source: "live";
      status: "empty" | "success";
    }
  | {
      correlationId: string;
      reason: PublicDataDegradedReason;
      source: "live";
      status: "degraded";
    }
  | {
      source: "live";
      status: "not_found";
    }
  | {
      data: T;
      source: "demo";
      status: "demo";
    };

type PublicDataLogInput = {
  correlationId?: string;
  error?: unknown;
  operation: string;
  reason: PublicDataDegradedReason;
};

export function createPublicDataCorrelationId() {
  return randomUUID();
}

export function isPublicDemoDataEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.TES_ENABLE_DEMO_DATA === "true"
  );
}

export function publicDataDegraded<T>(
  input: Omit<PublicDataLogInput, "correlationId"> & {
    correlationId?: string;
  },
): Extract<PublicDataResult<T>, { status: "degraded" }> {
  const correlationId = input.correlationId ?? createPublicDataCorrelationId();

  logPublicDataFailure({
    ...input,
    correlationId,
  });

  return {
    correlationId,
    reason: input.reason,
    source: "live",
    status: "degraded",
  };
}

export function logPublicDataFailure(input: PublicDataLogInput) {
  console.warn(
    JSON.stringify({
      category: sanitizeErrorCategory(input.error),
      correlationId: input.correlationId,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      event: "public_data_query_failed",
      operation: input.operation,
      reason: input.reason,
    }),
  );
}

function sanitizeErrorCategory(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "timeout";
    return error.name || "error";
  }

  return typeof error;
}
