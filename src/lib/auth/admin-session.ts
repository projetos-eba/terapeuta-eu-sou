import "server-only";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import {
  canUseAdminPermission,
  getAdminPermissionsForRole,
  type AdminPermission,
} from "@/lib/auth/admin-permissions";
import { routes } from "@/lib/routes";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

type SupabaseAuthUser = {
  id: string;
};

type ProfileRow = {
  avatar_url: string | null;
  display_name: string | null;
  email: string | null;
  id: string;
  role: "admin" | "patient" | "therapist";
};

export type AuthenticatedAdminSession = {
  accessToken: string;
  avatarUrl: string | null;
  email: string | null;
  name: string;
  permissions: AdminPermission[];
  role: "admin";
  userId: string;
};

type RequireAdminSessionOptions = {
  permission?: AdminPermission;
  permissions?: AdminPermission[];
};

export async function requireAdminSession(
  options: RequireAdminSessionOptions = {},
): Promise<AuthenticatedAdminSession> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_admin_access_token")?.value;
  const config = getSupabasePublicConfig();

  if (!accessToken || !config) {
    redirect(routes.admin.signIn);
  }

  try {
    const session = await readAdminSessionFromAccessToken(config, accessToken);

    if (!session) {
      redirect(routes.admin.signIn);
    }

    if (
      !hasRequiredAdminPermissions(
        session.permissions,
        getRequiredAdminPermissions(options),
      )
    ) {
      notFound();
    }

    return session;
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (isNextNotFound(error)) throw error;
    redirect(routes.admin.signIn);
  }
}

export function hasRequiredAdminPermissions(
  permissions: readonly AdminPermission[],
  requiredPermissions: readonly AdminPermission[],
) {
  return requiredPermissions.every((permission) =>
    canUseAdminPermission(permissions, permission),
  );
}

function getRequiredAdminPermissions(options: RequireAdminSessionOptions) {
  return [
    ...(options.permission ? [options.permission] : []),
    ...(options.permissions ?? []),
  ];
}

export async function readAdminSessionFromAccessToken(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  accessToken: string,
): Promise<AuthenticatedAdminSession | null> {
  const user = await requestSupabase<SupabaseAuthUser>(
    config,
    "/auth/v1/user",
    accessToken,
  );
  const profiles = await requestSupabase<ProfileRow[]>(
    config,
    `/rest/v1/profiles?select=id,display_name,email,avatar_url,role&id=eq.${encodeURIComponent(user.id)}&limit=1`,
    accessToken,
  );
  const profile = profiles[0];

  if (!profile || profile.role !== "admin") {
    return null;
  }

  return {
    accessToken,
    avatarUrl: profile.avatar_url,
    email: profile.email,
    name: profile.display_name || "Admin TES",
    permissions: getAdminPermissionsForRole(profile.role),
    role: profile.role,
    userId: user.id,
  };
}

async function requestSupabase<T>(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  path: string,
  accessToken: string,
): Promise<T> {
  const response = await fetch(`${config.url}${path}`, {
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) throw new Error("Admin session is invalid");
  return (await response.json()) as T;
}

function isNextRedirect(error: unknown) {
  return (
    error instanceof Error &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  );
}

function isNextNotFound(error: unknown) {
  return (
    error instanceof Error &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404")
  );
}
