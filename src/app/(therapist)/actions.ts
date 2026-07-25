"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

export async function logoutTherapist() {
  cookies().delete("tes_therapist_access_token");
  cookies().delete("tes_therapist_refresh_token");
  cookies().delete("tes_therapist_plan");
  redirect(routes.public.therapistSignIn);
}
