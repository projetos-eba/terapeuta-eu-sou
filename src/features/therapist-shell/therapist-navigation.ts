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
  getHref: (plan: TherapistPlan) => string | null;
  icon: TherapistShellNavigation[number]["icon"];
  label: string;
  planLabel?: "Premium" | "Premium Plus";
};

const definitions: NavigationDefinition[] = [
  {
    getHref: homeHref,
    icon: "home",
    label: "Início",
  },
  {
    capability: "operation_essentials",
    getHref: agendaHref,
    icon: "calendar",
    label: "Agenda",
  },
  {
    capability: "full_crm",
    getHref: patientsHref,
    icon: "route",
    label: "Histórico da Jornada",
    planLabel: "Premium Plus",
  },
  {
    capability: "operation_essentials",
    getHref: sessionsHref,
    icon: "heart",
    label: "Sessões",
  },
  {
    capability: "operation_essentials",
    getHref: messagesHref,
    icon: "message",
    label: "Mensagens",
  },
  {
    capability: "operation_essentials",
    getHref: servicesHref,
    icon: "sparkles",
    label: "Suas terapias",
  },
  {
    capability: "operation_essentials",
    getHref: profileHref,
    icon: "user-pen",
    label: "Meu perfil",
  },
  {
    feature: "reviews_testimonials",
    getHref: reviewsHref,
    icon: "star",
    label: "Avaliações",
    planLabel: "Premium",
  },
  {
    capability: "advanced_metrics",
    getHref: insightsHref,
    icon: "chart",
    label: "Métricas & Relatórios",
    planLabel: "Premium",
  },
  {
    capability: "aura_full",
    getHref: auraHref,
    icon: "brain",
    label: "Aura IA",
    planLabel: "Premium Plus",
  },
  {
    capability: "advanced_financials",
    getHref: financeHref,
    icon: "wallet",
    label: "Financeiro",
    planLabel: "Premium Plus",
  },
  {
    capability: "operation_essentials",
    getHref: settingsHref,
    icon: "settings",
    label: "Configurações",
  },
  {
    capability: "operation_essentials",
    getHref: supportHref,
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
  const upgradeHref =
    plan === TherapistPlan.Free
      ? routes.therapist.basicUpgrade
      : routes.therapist.proPlan;

  return definitions.map((definition) => {
    const href = definition.getHref(plan) ?? upgradeHref;
    const hasAccess = definition.capability
      ? canUseTherapistCapability(plan, definition.capability)
      : definition.feature
        ? planIncludesFeature(plan, definition.feature)
        : true;

    return {
      accessState: hasAccess ? "enabled" : "locked",
      badge: definition.label === "Mensagens" ? unreadMessagesCount : undefined,
      href,
      icon: definition.icon,
      label: definition.label,
      planLabel:
        definition.planLabel && !hasAccess ? definition.planLabel : undefined,
      upgradeHref: hasAccess ? undefined : upgradeHref,
    };
  });
}

function homeHref(plan: TherapistPlan) {
  if (plan === TherapistPlan.PremiumPlus) return routes.therapist.plusHome;
  if (plan === TherapistPlan.Premium) return routes.therapist.proHome;
  return routes.therapist.basicHome;
}

function agendaHref(plan: TherapistPlan) {
  if (plan === TherapistPlan.PremiumPlus) return routes.therapist.plusAgenda;
  if (plan === TherapistPlan.Premium) return routes.therapist.proAgenda;
  return routes.therapist.basicAgenda;
}

function patientsHref(plan: TherapistPlan) {
  if (plan === TherapistPlan.PremiumPlus) return routes.therapist.plusPatients;
  if (plan === TherapistPlan.Premium) return routes.therapist.proPatients;
  return routes.therapist.basicPatients;
}

function sessionsHref(plan: TherapistPlan) {
  if (plan === TherapistPlan.PremiumPlus) return routes.therapist.plusSessions;
  if (plan === TherapistPlan.Premium) return routes.therapist.proSessions;
  return routes.therapist.basicSessions;
}

function messagesHref(plan: TherapistPlan) {
  if (plan === TherapistPlan.PremiumPlus) return routes.therapist.plusMessages;
  if (plan === TherapistPlan.Premium) return routes.therapist.proMessages;
  return routes.therapist.basicMessages;
}

function servicesHref(plan: TherapistPlan) {
  if (plan === TherapistPlan.PremiumPlus) return routes.therapist.plusServices;
  if (plan === TherapistPlan.Premium) return routes.therapist.proServices;
  return routes.therapist.basicServices;
}

function profileHref(plan: TherapistPlan) {
  if (plan === TherapistPlan.PremiumPlus) return routes.therapist.plusProfile;
  if (plan === TherapistPlan.Premium) return routes.therapist.proProfile;
  return routes.therapist.basicProfile;
}

function reviewsHref(plan: TherapistPlan) {
  if (plan === TherapistPlan.PremiumPlus) return routes.therapist.plusReviews;
  if (plan === TherapistPlan.Premium) return routes.therapist.proReviews;
  return null;
}

function insightsHref(plan: TherapistPlan) {
  if (plan === TherapistPlan.PremiumPlus) return routes.therapist.plusInsights;
  if (plan === TherapistPlan.Premium) return routes.therapist.proMetrics;
  return null;
}

function auraHref(plan: TherapistPlan) {
  return plan === TherapistPlan.PremiumPlus
    ? routes.therapist.plusAssessorIa
    : null;
}

function financeHref(plan: TherapistPlan) {
  if (plan === TherapistPlan.PremiumPlus) return routes.therapist.plusFinance;
  if (plan === TherapistPlan.Premium) return routes.therapist.proFinance;
  return routes.therapist.basicPayment;
}

function settingsHref(plan: TherapistPlan) {
  if (plan === TherapistPlan.PremiumPlus) return routes.therapist.plusSettings;
  if (plan === TherapistPlan.Premium) return routes.therapist.proSettings;
  return routes.therapist.basicSettings;
}

function supportHref(plan: TherapistPlan) {
  if (plan === TherapistPlan.PremiumPlus) return routes.therapist.plusSupport;
  if (plan === TherapistPlan.Premium) return routes.therapist.proSupport;
  return routes.therapist.basicSupport;
}
