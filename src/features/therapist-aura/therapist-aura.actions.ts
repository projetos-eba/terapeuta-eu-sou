"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { routes } from "@/lib/routes";

import { dismissTherapistAuraSignal } from "./therapist-aura.queries";

const recommendationKeyPattern = /^[A-Za-z0-9._:-]{8,220}$/;

export async function dismissAuraRecommendationAction(formData: FormData) {
  const recommendationKey = stringField(formData, "recommendationKey");
  const ruleKey = stringField(formData, "ruleKey");
  const ruleVersion = numberField(formData, "ruleVersion");
  const periodStart = stringField(formData, "periodStart");
  const periodEnd = stringField(formData, "periodEnd");

  if (
    !recommendationKeyPattern.test(recommendationKey) ||
    !recommendationKeyPattern.test(ruleKey) ||
    !Number.isSafeInteger(ruleVersion) ||
    ruleVersion < 1 ||
    Number.isNaN(Date.parse(periodStart)) ||
    Number.isNaN(Date.parse(periodEnd))
  ) {
    return;
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_therapist_access_token")?.value;
  if (!accessToken) return;

  await dismissTherapistAuraSignal({
    accessToken,
    periodEnd,
    periodStart,
    recommendationKey,
    requestId: crypto.randomUUID(),
    ruleKey,
    ruleVersion,
  });

  revalidatePath(routes.therapist.assessorIa);
}

function stringField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function numberField(formData: FormData, key: string) {
  const value = Number(stringField(formData, key));
  return Number.isFinite(value) ? value : Number.NaN;
}
