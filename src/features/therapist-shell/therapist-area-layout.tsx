import type { ReactNode } from "react";

import { AuthenticatedShell } from "@/components/authenticated-shell";
import { getTherapistDashboardPage } from "@/features/therapist-dashboard";
import { requireTherapistSession } from "@/lib/auth/therapist-session";

import { getTherapistShellConfig } from "./therapist-shell-config";

export async function TherapistAreaLayout({
  children,
  logoutAction,
  namespace,
}: {
  children: ReactNode;
  logoutAction: () => Promise<void>;
  namespace: "basico" | "plus" | "pro";
}) {
  const session = await requireTherapistSession({ namespace });
  const dashboard =
    namespace === "plus"
      ? await getDashboardCountsSafely(session.accessToken, session.profileId)
      : null;
  const config = getTherapistShellConfig({
    plan: session.plan,
    unreadMessagesCount: dashboard?.unreadMessagesCount ?? 0,
  });
  const firstName = session.name.trim().split(/\s+/)[0] || "Terapeuta";

  return (
    <AuthenticatedShell
      helpCardVariant={config.helpCardVariant}
      helpHref={config.helpHref}
      logoutAction={logoutAction}
      navigation={config.navigation}
      notificationCount={dashboard?.unreadNotificationsCount ?? 0}
      planLabel={config.planLabel}
      user={{
        avatarUrl: session.avatarUrl,
        name: firstName,
        planLabel: config.planLabel,
        roleLabel: "Terapeuta",
      }}
      variant="therapist"
    >
      {children}
    </AuthenticatedShell>
  );
}

async function getDashboardCountsSafely(
  accessToken: string,
  profileId: string,
) {
  try {
    return await getTherapistDashboardPage({ accessToken, profileId });
  } catch {
    console.warn(
      "[therapist-shell] Dashboard counters are temporarily unavailable.",
    );
    return null;
  }
}
