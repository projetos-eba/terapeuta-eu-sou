import "server-only";

import { cache } from "react";

import { mapTherapistConnectAccount } from "@/features/therapist-finance/therapist-finance.mappers";
import { queryTherapistConnectAccount } from "@/features/therapist-finance/therapist-finance.queries";
import type { TherapistConnectAccount } from "@/features/therapist-finance/therapist-finance.types";
import { getTherapistProfileEditorPage } from "@/features/therapist-profile-editor/therapist-profile-editor.queries";
import type { AuthenticatedTherapistSession } from "@/lib/auth/therapist-session";

import { TherapistDashboardError } from "./therapist-dashboard.errors";
import { mapTherapistHomeReadiness } from "./therapist-home-readiness.mappers";
import type { TherapistHomeReadiness } from "./therapist-home-readiness.types";

export const getTherapistHomeReadiness = cache(
  async function getTherapistHomeReadiness({
    session,
  }: {
    session: AuthenticatedTherapistSession;
  }): Promise<TherapistHomeReadiness> {
    const [profileResult, connect] = await Promise.all([
      getTherapistProfileEditorPage({ accessToken: session.accessToken }),
      queryConnectSafely(session.accessToken),
    ]);

    if (profileResult.status === "error") {
      console.error(
        JSON.stringify({
          code: "profile_read_failed",
          operation: "therapist_home_readiness",
          profileId: session.profileId,
          requestId: profileResult.requestId ?? null,
        }),
      );
      throw new TherapistDashboardError("unavailable");
    }

    try {
      return mapTherapistHomeReadiness({
        connect,
        editor: profileResult.editor,
        session,
      });
    } catch {
      throw new TherapistDashboardError("invalid_response");
    }
  },
);

async function queryConnectSafely(
  accessToken: string,
): Promise<TherapistConnectAccount | null> {
  try {
    return mapTherapistConnectAccount(
      await queryTherapistConnectAccount(accessToken),
    );
  } catch {
    console.warn(
      JSON.stringify({
        code: "connect_read_failed",
        operation: "therapist_home_readiness",
      }),
    );
    return null;
  }
}
