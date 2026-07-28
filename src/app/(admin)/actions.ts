"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete("tes_admin_access_token");
  cookieStore.delete("tes_admin_refresh_token");
  redirect(routes.admin.signIn);
}
