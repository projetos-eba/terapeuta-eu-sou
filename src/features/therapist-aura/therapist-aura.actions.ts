"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { routes } from "@/lib/routes";

import {
  getTherapistAuraErrorMessage,
  TherapistAuraError,
  type TherapistAuraErrorCode,
} from "./therapist-aura.errors";
import { isTherapistAuraEnabled } from "./therapist-aura-feature";
import { dismissTherapistAuraSignal } from "./therapist-aura.queries";

const recommendationKeyPattern = /^[A-Za-z0-9._:-]{8,220}$/;

export type AuraDismissActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export async function dismissAuraRecommendationAction(
  _previousState: AuraDismissActionState,
  formData: FormData,
): Promise<AuraDismissActionState> {
  if (!isTherapistAuraEnabled()) return errorState("coming_soon");

  const recommendationKey = stringField(formData, "recommendationKey");
  const periodStart = stringField(formData, "periodStart");
  const periodEnd = stringField(formData, "periodEnd");

  if (
    !recommendationKeyPattern.test(recommendationKey) ||
    Number.isNaN(Date.parse(periodStart)) ||
    Number.isNaN(Date.parse(periodEnd))
  ) {
    return errorState("invalid_contract");
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_therapist_access_token")?.value;
  if (!accessToken) return errorState("session_expired");

  try {
    await dismissTherapistAuraSignal({
      accessToken,
      periodEnd,
      periodStart,
      recommendationKey,
      requestId: crypto.randomUUID(),
    });

    revalidatePath(routes.therapist.assessorIa);
    return {
      message: "Recomendação dispensada nesta janela.",
      status: "success",
    };
  } catch (error) {
    if (error instanceof TherapistAuraError) {
      return errorState(error.code);
    }
    return errorState("unavailable");
  }
}

function stringField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function errorState(code: TherapistAuraErrorCode): AuraDismissActionState {
  return {
    message: getTherapistAuraErrorMessage(code),
    status: "error",
  };
}
