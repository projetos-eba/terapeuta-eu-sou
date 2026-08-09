import type { ShellNavigationItem } from "@/components/authenticated-shell";
import type { AdminPermission } from "@/lib/auth/admin-permissions";
import { routes } from "@/lib/routes";

type AdminModuleKey =
  | "dashboard"
  | "integrations"
  | "matching"
  | "patients"
  | "payments"
  | "professionals"
  | "reports"
  | "reviews"
  | "security"
  | "sessions"
  | "settings"
  | "subscriptions"
  | "support"
  | "therapies"
  | "verifications";

type AdminModuleStatus = "enabled" | "hidden";

type AdminModule = ShellNavigationItem & {
  group:
    | "dashboard"
    | "discovery"
    | "finance"
    | "operation"
    | "people"
    | "platform";
  key: AdminModuleKey;
  parentKey?: AdminModuleKey;
  permission: AdminPermission;
  status: AdminModuleStatus;
};

export const adminModuleRegistry: AdminModule[] = [
  {
    group: "dashboard",
    href: routes.admin.home,
    icon: "home",
    key: "dashboard",
    label: "Visão geral",
    permission: "admin.dashboard.read",
    status: "enabled",
  },
  {
    group: "people",
    href: routes.admin.professionals,
    icon: "user",
    key: "professionals",
    label: "Profissionais",
    permission: "admin.professionals.read",
    status: "enabled",
  },
  {
    group: "people",
    href: routes.admin.verifications,
    icon: "user-pen",
    key: "verifications",
    label: "Verificações",
    parentKey: "professionals",
    permission: "admin.professionals.verify",
    status: "enabled",
  },
  {
    group: "people",
    href: routes.admin.patients,
    icon: "heart",
    key: "patients",
    label: "Clientes",
    permission: "admin.patients.read",
    status: "enabled",
  },
  {
    group: "operation",
    href: routes.admin.sessions,
    icon: "calendar",
    key: "sessions",
    label: "Sessões",
    permission: "admin.sessions.read",
    status: "enabled",
  },
  {
    group: "operation",
    href: routes.admin.support,
    icon: "help",
    key: "support",
    label: "Suporte",
    permission: "admin.support.read",
    status: "enabled",
  },
  {
    group: "operation",
    href: routes.admin.reviews,
    icon: "star",
    key: "reviews",
    label: "Avaliações",
    permission: "admin.reviews.read",
    status: "enabled",
  },
  {
    group: "finance",
    href: routes.admin.payments,
    icon: "wallet",
    key: "payments",
    label: "Financeiro",
    permission: "admin.payments.read",
    status: "enabled",
  },
  {
    group: "finance",
    href: routes.admin.subscriptions,
    icon: "credit-card",
    key: "subscriptions",
    label: "Assinaturas",
    permission: "admin.subscriptions.read",
    status: "enabled",
  },
  {
    group: "discovery",
    href: routes.admin.therapies,
    icon: "sparkles",
    key: "therapies",
    label: "Terapias",
    permission: "admin.therapies.read",
    status: "enabled",
  },
  {
    group: "discovery",
    href: routes.admin.matching,
    icon: "search",
    key: "matching",
    label: "Match",
    permission: "admin.matching.read",
    status: "enabled",
  },
  {
    group: "platform",
    href: routes.admin.integrations,
    icon: "route",
    key: "integrations",
    label: "Integrações",
    permission: "admin.integrations.read",
    status: "hidden",
  },
  {
    group: "platform",
    href: routes.admin.security,
    icon: "settings",
    key: "security",
    label: "Segurança",
    permission: "admin.security.read",
    status: "enabled",
  },
  {
    group: "platform",
    href: routes.admin.reports,
    icon: "chart",
    key: "reports",
    label: "Relatórios",
    permission: "admin.reports.read",
    status: "hidden",
  },
  {
    group: "platform",
    href: routes.admin.settings,
    icon: "settings",
    key: "settings",
    label: "Configurações",
    permission: "admin.settings.read",
    status: "enabled",
  },
];

export function getAdminShellConfig(): {
  helpHref?: string;
  navigation: ShellNavigationItem[];
} {
  const navigation = adminModuleRegistry
    .filter(
      (module) => module.status === "enabled" && module.parentKey === undefined,
    )
    .map((module) => {
      const children = adminModuleRegistry
        .filter(
          (child) =>
            child.status === "enabled" &&
            child.parentKey === module.key,
        )
        .map((child) => ({
          href: child.href,
          icon: child.icon,
          label: child.label,
        }));

      return {
        children: children.length > 0 ? children : undefined,
        href: module.href,
        icon: module.icon,
        label: module.label,
      };
    });

  return { navigation };
}
