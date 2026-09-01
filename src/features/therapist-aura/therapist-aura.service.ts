import "server-only";

import { cache } from "react";

import type { TherapistPlan } from "@/domain/tes";

import {
  getTherapistAuraErrorMessage,
  TherapistAuraError,
} from "./therapist-aura.errors";
import { getTherapistAuraFeatureAccess } from "./therapist-aura-feature";
import { mapTherapistAuraSignals } from "./therapist-aura.mappers";
import { queryTherapistAuraSignals } from "./therapist-aura.queries";
import type { TherapistAuraErrorCode } from "./therapist-aura.errors";
import type { TherapistAuraPageData } from "./therapist-aura.types";

export type TherapistAuraPageResult =
  | {
      data: TherapistAuraPageData;
      ok: true;
    }
  | {
      code: TherapistAuraErrorCode;
      message: string;
      ok: false;
    };

export const getTherapistAuraPage = cache(async function getTherapistAuraPage({
  accessToken,
  periodDays,
  plan,
  profileId,
}: {
  accessToken: string;
  periodDays: 30 | 90;
  plan: TherapistPlan;
  profileId: string;
}): Promise<TherapistAuraPageResult> {
  const access = getTherapistAuraFeatureAccess(plan);

  if (!access.launchEnabled) {
    const code = "coming_soon" as const;
    return {
      code,
      message: getTherapistAuraErrorMessage(code),
      ok: false,
    };
  }

  if (!access.hasEntitlement) {
    const code = "forbidden" as const;
    return {
      code,
      message: getTherapistAuraErrorMessage(code),
      ok: false,
    };
  }

  try {
    const data = mapTherapistAuraSignals(
      await queryTherapistAuraSignals(accessToken, periodDays),
    );

    if (data.therapist.profileId !== profileId) {
      throw new TherapistAuraError("forbidden");
    }

    return { data, ok: true };
  } catch (error) {
    const code =
      error instanceof TherapistAuraError ? error.code : "unavailable";
    return {
      code,
      message: getTherapistAuraErrorMessage(code),
      ok: false,
    };
  }
});
