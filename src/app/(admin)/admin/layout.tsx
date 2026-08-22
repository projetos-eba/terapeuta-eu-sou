import type { ReactNode } from "react";

import { AuthenticatedShell } from "@/components/authenticated-shell";
import { getAdminShellConfig } from "@/features/admin-shell/admin-shell-config";
import { requireAdminSession } from "@/lib/auth/admin-session";

import { logoutAdmin } from "../actions";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireAdminSession();
  const config = getAdminShellConfig();
  const firstName = session.name.trim().split(/\s+/)[0] || "Admin";

  return (
    <AuthenticatedShell
      helpHref={config.helpHref}
      helpLabel="Suporte interno"
      logoutAction={logoutAdmin}
      navigation={config.navigation}
      user={{
        avatarUrl: session.avatarUrl,
        email: session.email,
        fullName: session.name,
        name: firstName,
        roleLabel: "Admin",
      }}
      variant="admin"
    >
      {children}
    </AuthenticatedShell>
  );
}
