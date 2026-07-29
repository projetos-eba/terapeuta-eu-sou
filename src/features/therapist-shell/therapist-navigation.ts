import {
  canUseTherapistCapability,
  planIncludesFeature,
  TherapistPlan,
  type PlanFeatureCode,
  type TherapistCapability,
} from "@/domain/tes";
import { routes } from "@/lib/routes";

import type { TherapistShellNavigation } from "./therapist-shell.types";

type NavigationDefinition = {
  capability?: TherapistCapability;
  feature?: PlanFeatureCode;
  href: string;
  icon: TherapistShellNavigation[number]["icon"];
  label: string;
  planLabel?: "Premium" | "Premium Plus";
};

const definitions: NavigationDefinition[] = [
  {
    href: routes.therapist.home,
    icon: "home",
    label: "Início",
  },
  {
    capability: "operation_essentials",
    href: routes.therapist.agenda,
    icon: "calendar",
    label: "Agenda",
  },
  {
    capability: "full_crm",
    href: routes.therapist.patients,
    icon: "route",
    label: "Histórico da Jornada",
    planLabel: "Premium Plus",
  },
  {
    capability: "operation_essentials",
    href: routes.therapist.sessions,
    icon: "heart",
    label: "Sessões",
  },
  {
    capability: "operation_essentials",
    href: routes.therapist.messages,
    icon: "message",
    label: "Mensagens",
  },
  {
    capability: "operation_essentials",
    href: routes.therapist.services,
    icon: "sparkles",
    label: "Suas terapias",
  },
  {
    capability: "operation_essentials",
    href: routes.therapist.profile,
    icon: "user-pen",
    label: "Meu perfil",
  },
  {
    feature: "reviews_testimonials",
    href: routes.therapist.reviews,
    icon: "star",
    label: "Avaliações",
    planLabel: "Premium",
  },
  {
    capability: "advanced_metrics",
    href: routes.therapist.insights,
    icon: "chart",
    label: "Métricas & Relatórios",
    planLabel: "Premium",
  },
  {
    capability: "aura_full",
    href: routes.therapist.assessorIa,
    icon: "brain",
    label: "Aura IA",
    planLabel: "Premium Plus",
  },
  {
    capability: "operation_essentials",
    href: routes.therapist.finance,
    icon: "wallet",
    label: "Financeiro",
  },
  {
    capability: "operation_essentials",
    href: routes.therapist.settings,
    icon: "settings",
    label: "Configurações",
  },
  {
    capability: "operation_essentials",
    href: routes.therapist.support,
    icon: "help",
    label: "Ajuda",
  },
];

export function buildTherapistNavigation({
  plan,
  unreadMessagesCount,
}: {
  plan: TherapistPlan;
  unreadMessagesCount: number;
}): TherapistShellNavigation {
  const upgradeHref = routes.therapist.plan;

  return definitions.map((definition) => {
    const hasAccess = definition.capability
      ? canUseTherapistCapability(plan, definition.capability)
      : definition.feature
        ? planIncludesFeature(plan, definition.feature)
        : true;

    return {
      accessState: hasAccess ? "enabled" : "locked",
      badge: definition.label === "Mensagens" ? unreadMessagesCount : undefined,
      href: definition.href,
      icon: definition.icon,
      label: definition.label,
      planLabel:
        definition.planLabel && !hasAccess ? definition.planLabel : undefined,
      upgradeHref: hasAccess ? undefined : upgradeHref,
    };
  });
}
