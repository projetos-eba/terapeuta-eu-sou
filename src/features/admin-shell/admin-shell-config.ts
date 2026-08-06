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
    ],
  };
}
