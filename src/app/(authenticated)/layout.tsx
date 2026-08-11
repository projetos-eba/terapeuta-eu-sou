import type { ReactNode } from "react";

import {
  AuthenticatedShell,
  type ShellNavigationItem,
} from "@/components/authenticated-shell";
import { getPatientOverview } from "@/features/patient-overview";
import { requirePatientSession } from "@/lib/auth/patient-session";
import { routes } from "@/lib/routes";

import { logoutPatient } from "./actions";

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requirePatientSession();
  const overview = await getPatientOverview(
    session.profileId,
    session.accessToken,
  ).catch(() => null);
  const navigation: ShellNavigationItem[] = [
    { href: routes.patient.home, icon: "home", label: "Início" },
    {
      href: routes.public.therapists,
      icon: "search",
      label: "Encontrar terapeutas",
    },
    { href: routes.patient.encounters, icon: "calendar", label: "Encontros" },
    {
      href: routes.patient.favoriteTherapists,
      icon: "heart",
      label: "Favoritos",
    },
    {
      badge: overview?.unreadMessagesCount,
      href: routes.patient.messages,
      icon: "message",
      label: "Mensagens",
    },
  ];

  return (
    <AuthenticatedShell
      helpHref={`${routes.patient.messages}?context=suporte`}
      logoutAction={logoutPatient}
      navigation={navigation}
      notificationCount={overview?.unreadNotificationsCount ?? 0}
      user={{
        avatarUrl: overview?.patient.avatarUrl,
        name: overview?.patient.name ?? "Paciente",
        roleLabel: "Paciente",
      }}
    >
      {children}
    </AuthenticatedShell>
  );
}
