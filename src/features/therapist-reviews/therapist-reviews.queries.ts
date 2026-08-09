import "server-only";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import {
  getDefaultMessage,
  TherapistReviewsError,
} from "./therapist-reviews.errors";

export async function queryTherapistReviews(accessToken: string) {
  return requestSupabase<unknown>(
    "/rest/v1/rpc/get_therapist_reviews_v1",
    accessToken,
    {
      body: {},
      method: "POST",
    },
  );
}

export async function mutateTherapistReviewReply({
  accessToken,
  body,
  requestId,
  reviewId,
}: {
  accessToken: string;
  body: string;
  requestId: string;
  reviewId: string;
}) {
  const config = getSupabasePublicConfig();
  if (!config) throw new TherapistReviewsError("unavailable");

  const response = await fetch(
    `${config.url}/functions/v1/therapist-reviews-command`,
    {
      body: JSON.stringify({
        action: "reply",
        body,
        requestId,
        reviewId,
      }),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  const payload = (await response.json().catch(() => null)) as EdgeEnvelope;

  if (response.status === 401) {
    throw new TherapistReviewsError("session_expired");
  }

  if (response.status === 403 || response.status === 404) {
    throw new TherapistReviewsError("forbidden");
  }

  if (!response.ok || !payload || payload.ok !== true) {
    const errorPayload =
      payload && "error" in payload ? payload.error : payload;
    throw mapRpcError(errorPayload);
  }

  return payload.data;
}

async function requestSupabase<T>(
  path: string,
  accessToken: string,
  options: { body?: unknown; method: "GET" | "POST" },
): Promise<T> {
  const config = getSupabasePublicConfig();
  if (!config) throw new TherapistReviewsError("unavailable");

  const response = await fetch(`${config.url}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: options.method,
  });

  if (response.status === 401) {
    throw new TherapistReviewsError("session_expired");
  }

  if (response.status === 403 || response.status === 404) {
    throw new TherapistReviewsError("forbidden");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as unknown;
    throw mapRpcError(payload);
  }

  return (await response.json()) as T;
}

function mapRpcError(payload: unknown) {
  const recordPayload = isRecord(payload) ? payload : {};
  const code = string(recordPayload.code);
  const message = string(recordPayload.message);

  if (code === "REQUEST_CONFLICT" || message === "REQUEST_CONFLICT") {
    return new TherapistReviewsError("request_conflict");
  }
  if (code === "REVIEW_NOT_FOUND" || message === "REVIEW_NOT_FOUND") {
    return new TherapistReviewsError("review_not_found");
  }
  if (code === "VALIDATION_ERROR" || message === "VALIDATION_ERROR") {
    return new TherapistReviewsError("validation_error");
  }
  if (code === "PROFILE_NOT_FOUND" || message === "PROFILE_NOT_FOUND") {
    return new TherapistReviewsError("forbidden");
  }
  if (code === "CAPABILITY_NOT_ALLOWED" || message === "CAPABILITY_NOT_ALLOWED") {
    return new TherapistReviewsError("forbidden");
  }
  if (code === "FORBIDDEN") return new TherapistReviewsError("forbidden");

  return new TherapistReviewsError("unavailable");
}

type EdgeEnvelope =
  | {
      data: unknown;
      ok: true;
    }
  | {
      error?: {
        code?: string;
        message?: string;
      };
      ok: false;
    }
  | null;

export function getTherapistReviewsErrorMessage(error: unknown) {
  if (error instanceof TherapistReviewsError) {
    return getDefaultMessage(error.code);
  }
  return getDefaultMessage("unavailable");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function string(value: unknown) {
  return typeof value === "string" ? value : "";
}
