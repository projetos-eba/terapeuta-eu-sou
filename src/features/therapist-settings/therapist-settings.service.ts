import "server-only";

import { cache } from "react";

import {
  createCorrelationId,
  logServerOperationFailure,
} from "@/lib/observability/server-operation-log";

import { mapTherapistSettingsData } from "./therapist-settings.mappers";
import {
  queryTherapistSettings,
  TherapistSettingsQueryError,
} from "./therapist-settings.queries";
import type { TherapistSettingsData } from "./therapist-settings.types";

export type TherapistSettingsPageResult =
  | { data: TherapistSettingsData; status: "success" }
  | {
      code: "forbidden" | "unavailable";
      message: string;
      status: "error";
    };

export const getTherapistSettingsPage = cache(
  async function getTherapistSettingsPage({
    accessToken,
    profileId,
    userId,
  }: {
    accessToken: string;
    profileId: string;
    userId: string;
  }): Promise<TherapistSettingsPageResult> {
    const startedAt = performance.now();

    try {
      const data = mapTherapistSettingsData(
        await queryTherapistSettings({ accessToken, userId }),
      );

      if (data.profile.profileId !== profileId || data.account.userId !== userId) {
        return {
          code: "forbidden",
          message: getTherapistSettingsErrorMessage("forbidden"),
          status: "error",
        };
      }

      return { data, status: "success" };
    } catch (error) {
      const code =
        error instanceof TherapistSettingsQueryError
          ? error.code
          : "unavailable";

      logServerOperationFailure({
        actorRole: "therapist",
        correlationId: createCorrelationId(),
        durationMs: performance.now() - startedAt,
        errorCode: code,
        operation: "therapist_settings_page",
      });

      return {
        code,
        message: getTherapistSettingsErrorMessage(code),
        status: "error",
      };
    }
  },
);

export function getTherapistSettingsErrorMessage(
  code: "forbidden" | "unavailable",
) {
  if (code === "forbidden") {
    return "Use uma conta de terapeuta para acessar as configurações.";
  }
  return "Não foi possível carregar suas configurações agora.";
}
