import "server-only";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import type {
  SessionObservation,
  SessionObservationAccess,
} from "./session-observation.types";

type ObservationCommandPayload = {
  data?: SessionObservationAccess;
  ok?: boolean;
};

export async function getTherapistSessionObservation(input: {
  accessToken: string;
  bookingId: string;
}): Promise<SessionObservationAccess | null> {
  const config = getSupabasePublicConfig();
  if (!config) return null;

  try {
    const response = await fetch(
      `${config.url}/functions/v1/session-observations-command?bookingId=${encodeURIComponent(input.bookingId)}`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${input.accessToken}` },
      },
    );
    const payload = (await response.json().catch(() => null)) as ObservationCommandPayload | null;
    if (!response.ok || !payload?.ok || !isAccess(payload.data)) return null;

    return payload.data;
  } catch {
    return null;
  }
}

function isAccess(value: unknown): value is SessionObservationAccess {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { canEdit?: unknown; observation?: unknown };
  return typeof candidate.canEdit === "boolean" &&
    (candidate.observation === null || isObservation(candidate.observation));
}

function isObservation(value: unknown): value is SessionObservation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SessionObservation>;
  return typeof candidate.bookingId === "string" &&
    typeof candidate.content === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string";
}
