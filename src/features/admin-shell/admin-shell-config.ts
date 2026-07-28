import type { ShellNavigationItem } from "@/components/authenticated-shell";
import { routes } from "@/lib/routes";

export function getAdminShellConfig(): {
  helpHref: string;
  navigation: ShellNavigationItem[];
} {
  return {
    helpHref: routes.admin.support,
    navigation: [
      {
        href: routes.admin.home,
        icon: "home",
        label: "Visão geral",
      },
      {
        href: routes.admin.therapies,
        icon: "sparkles",
        label: "Terapias",
      },
      {
        href: routes.admin.matching,
        icon: "search",
        label: "Match",
      },
      {
        href: routes.admin.professionals,
        icon: "user-pen",
        label: "Profissionais",
      },
      {
        href: routes.admin.sessions,
        icon: "calendar",
        label: "Sessões",
      },
      {
        href: routes.admin.payments,
        icon: "wallet",
        label: "Pagamentos",
      },
      {
        href: routes.admin.security,
        icon: "settings",
        label: "Segurança",
      },
    ],
  };
}
