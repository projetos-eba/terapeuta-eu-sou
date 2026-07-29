"use client";

import {
  normalizeTherapistReviewsError,
  type TherapistReviewsApiError,
} from "./therapist-reviews.errors";
import { mapTherapistReviewReplyResult } from "./therapist-reviews.mappers";
import type {
  TherapistReviewReplyCommand,
  TherapistReviewReplyResult,
} from "./therapist-reviews.types";

type ApiEnvelope<T> =
  | { data: T; ok: true }
  | {
      error?: {
        code?: string;
        message?: string;
      };
      ok: false;
    };

export type TherapistReviewCommandResult =
  | { data: TherapistReviewReplyResult; status: "success" }
  | { error: TherapistReviewsApiError; status: "error" };

export async function sendTherapistReviewCommand(
  command: TherapistReviewReplyCommand,
): Promise<TherapistReviewCommandResult> {
  try {
    const response = await fetch("/api/therapist/reviews", {
      body: JSON.stringify(command),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = (await response
      .json()
      .catch(() => null)) as ApiEnvelope<unknown>;

    if (!response.ok || !payload?.ok) {
      return {
        error: {
          ...normalizeTherapistReviewsError(payload),
          status: response.status,
        },
        status: "error",
      };
    }

    return {
      data: mapTherapistReviewReplyResult(payload.data),
      status: "success",
    };
  } catch {
    return {
      error: {
        code: "network_error",
        message: "Não foi possível conectar agora. Tente novamente.",
      },
      status: "error",
    };
  }
}

export function createStableRequestId() {
  return crypto.randomUUID();
}
