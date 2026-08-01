import "server-only";

import { cache } from "react";

import {
  getTherapistAuraErrorMessage,
  TherapistAuraError,
} from "./therapist-aura.errors";
import { mapTherapistAuraSignals } from "./therapist-aura.mappers";
import { queryTherapistAuraSignals } from "./therapist-aura.queries";
import type {
  TherapistAuraErrorCode,
} from "./therapist-aura.errors";
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

export const getTherapistAuraPage = cache(
  async function getTherapistAuraPage({
    accessToken,
    periodDays,
    profileId,
  }: {
    accessToken: string;
    periodDays: 30 | 90;
    profileId: string;
  }): Promise<TherapistAuraPageResult> {
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
  },
);
