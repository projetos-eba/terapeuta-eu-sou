import type { ReactNode } from "react";

import { AuthenticatedShell } from "@/components/authenticated-shell";
import { getTherapistAuraFeatureAccess } from "@/features/therapist-aura";
import { requireTherapistSession } from "@/lib/auth/therapist-session";

import { getTherapistShellConfig } from "./therapist-shell-config";
import { getTherapistShellCounters } from "./therapist-shell-counters";

export async function TherapistAreaLayout({
  children,
  logoutAction,
}: {
  children: ReactNode;
  logoutAction: () => Promise<void>;
}) {
  const session = await requireTherapistSession();
  const counters = await getTherapistShellCounters({
    accessToken: session.accessToken,
    profileId: session.profileId,
  });
  const config = getTherapistShellConfig({
    auraLaunchEnabled: getTherapistAuraFeatureAccess(session.plan)
      .launchEnabled,
    plan: session.plan,
    unreadMessagesCount: counters.unreadMessages,
  });
  const firstName = session.name.trim().split(/\s+/)[0] || "Terapeuta";

  return (
    <AuthenticatedShell
      logoutAction={logoutAction}
      navigation={config.navigation}
      notificationCount={counters.unreadNotifications}
      planLabel={config.planLabel}
      user={{
        avatarUrl: session.avatarUrl,
        email: session.email,
        fullName: session.name,
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
