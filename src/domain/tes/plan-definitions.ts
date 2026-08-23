import { routes } from "@/lib/routes";

import { TherapistPlan } from "./enums";
import type { TherapistCapability } from "./permissions";

export type PlanFeatureCode =
  | "agenda_days_blocks"
  | "profile_focus_cover_bio"
  | "shareable_public_profile"
  | "automatic_consultation_confirmation"
  | "closed_portal_sessions"
  | "username_url"
  | "visual_identity_customization"
  | "premium_profile_themes"
  | "reviews_testimonials"
  | "verification_badge"
  | "automatic_reminders_partial"
  | "search_visibility"
  | "profile_metrics"
  | "short_videos_presentation_video"
  | "aura"
  | "complete_financial_dashboard"
  | "complete_message_automation"
  | "journey_history_crm"
  | "advanced_badge_system"
  | "seasonal_campaigns"
  | "tes_academy";

export type PlanFeatureCategory =
  | "base"
  | "premium"
  | "premium_plus"
  | "academy";

export type PlanFeatureDefinition = {
  category: PlanFeatureCategory;
  code: PlanFeatureCode;
  description: string;
  label: string;
  minimumPlan: TherapistPlan;
  capability?: TherapistCapability;
};

export type PlanDefinition = {
  code: TherapistPlan;
  ctaLabel: string;
  description: string;
  features: PlanFeatureCode[];
  highlight?: boolean;
  monthlyPriceCents: number;
  limits: {
    messages?: number;
    services?: number;
  };
  name: string;
  priceLabel: string;
  priceNote: string;
  signupHref: string;
  stripePriceId: null;
  subtitle: string;
};

export const therapistPlanFeatureDefinitions: PlanFeatureDefinition[] = [
  {
    category: "base",
    code: "agenda_days_blocks",
    description:
      "Agenda, bloqueios e horários para organizar seus atendimentos.",
    label: "Agenda, bloqueio de dias e horários",
    minimumPlan: TherapistPlan.Free,
    capability: "operation_essentials",
  },
  {
    category: "base",
    code: "profile_focus_cover_bio",
    description: "Foto, apresentação e informações principais do seu perfil.",
    label: "Foto, apresentação e especialidades",
    minimumPlan: TherapistPlan.Free,
    capability: "operation_essentials",
  },
  {
    category: "base",
    code: "shareable_public_profile",
    description: "Perfil público com link para compartilhamento.",
    label: "Perfil público + link para compartilhar",
    minimumPlan: TherapistPlan.Free,
    capability: "operation_essentials",
  },
  {
    category: "base",
    code: "automatic_consultation_confirmation",
    description: "Confirmação automática das sessões dentro do TES.",
    label: "Confirmação automática de sessão",
    minimumPlan: TherapistPlan.Free,
    capability: "operation_essentials",
  },
  {
    category: "base",
    code: "closed_portal_sessions",
    description: "Atendimento organizado dentro do TES.",
    label: "Sessões dentro do TES",
    minimumPlan: TherapistPlan.Free,
    capability: "operation_essentials",
  },
  {
    category: "premium",
    code: "username_url",
    description: "Um link personalizado para compartilhar seu perfil.",
    label: "Link do perfil com o seu nome",
    minimumPlan: TherapistPlan.Premium,
    capability: "custom_profile_slug",
  },
  {
    category: "base",
    code: "visual_identity_customization",
    description: "Quatro temas oficiais e ilustrações TES para a presença pública.",
    label: "Temas básicos e ilustração do perfil público",
    minimumPlan: TherapistPlan.Free,
  },
  {
    category: "premium",
    code: "premium_profile_themes",
    description:
      "Quinze composições Premium com backgrounds e recortes exclusivos para o perfil público.",
    label: "Biblioteca Premium de temas do perfil",
    minimumPlan: TherapistPlan.Premium,
  },
  {
    category: "premium",
    code: "reviews_testimonials",
    description: "Avaliações publicadas e depoimentos moderados.",
    label: "Avaliações e depoimentos",
    minimumPlan: TherapistPlan.Premium,
  },
  {
    category: "premium",
    code: "verification_badge",
    description: "Selo de verificação exibido conforme regras da plataforma.",
    label: "Selo de verificação",
    minimumPlan: TherapistPlan.Premium,
  },
  {
    category: "premium",
    code: "automatic_reminders_partial",
    description:
      "Lembretes automáticos para ajudar no acompanhamento das sessões.",
    label: "Lembretes automáticos",
    minimumPlan: TherapistPlan.Premium,
    capability: "agenda_insights",
  },
  {
    category: "premium",
    code: "search_visibility",
    description:
      "Destaque de visibilidade dentro das regras de busca da plataforma.",
    label: "Visibilidade na busca",
    minimumPlan: TherapistPlan.Premium,
  },
  {
    category: "premium",
    code: "profile_metrics",
    description: "Métricas do perfil, como visitas e cliques.",
    label: "Métricas do perfil (visitas, cliques)",
    minimumPlan: TherapistPlan.Premium,
    capability: "advanced_metrics",
  },
  {
    category: "premium_plus",
    code: "short_videos_presentation_video",
    description: "Vídeos curtos e vídeo de apresentação do perfil.",
    label: "Vídeos curtos / vídeo de apresentação",
    minimumPlan: TherapistPlan.PremiumPlus,
  },
  {
    category: "premium_plus",
    code: "aura",
    description:
      "Dicas do Assessor Aura para cuidar melhor da sua presença no TES.",
    minimumPlan: TherapistPlan.PremiumPlus,
    label: "Aura",
    capability: "aura_full",
  },
  {
    category: "premium_plus",
    code: "complete_financial_dashboard",
    description: "Visão ampliada dos recebimentos e do movimento financeiro.",
    label: "Visão completa dos recebimentos",
    minimumPlan: TherapistPlan.PremiumPlus,
    capability: "advanced_financials",
  },
  {
    category: "premium_plus",
    code: "complete_message_automation",
    description: "Mais recursos para organizar suas mensagens.",
    label: "Organização de mensagens",
    minimumPlan: TherapistPlan.PremiumPlus,
    capability: "aura_full",
  },
  {
    category: "premium_plus",
    code: "journey_history_crm",
    description: "Acompanhe o caminho das pessoas que já chegaram até você.",
    label: "Histórico de pessoas atendidas",
    minimumPlan: TherapistPlan.PremiumPlus,
    capability: "full_crm",
  },
  {
    category: "premium_plus",
    code: "advanced_badge_system",
    description: "Mais formas de destacar sua experiência e seu trabalho.",
    label: "Destaques do perfil",
    minimumPlan: TherapistPlan.PremiumPlus,
  },
  {
    category: "premium_plus",
    code: "seasonal_campaigns",
    description:
      "Participação em campanhas especiais do TES quando disponível.",
    label: "Participação em campanhas sazonais (Em breve)",
    minimumPlan: TherapistPlan.PremiumPlus,
  },
  {
    category: "academy",
    code: "tes_academy",
    description: "Conteúdos de apoio do TES quando disponível.",
    label: "Academia TES (Em breve)",
    minimumPlan: TherapistPlan.PremiumPlus,
  },
];

export function getPlanSignupHref(plan: TherapistPlan) {
  return `${routes.public.therapistSignUp}?plan=${plan}`;
}

export const therapistPlanDefinitions: PlanDefinition[] = [
  {
    code: TherapistPlan.Free,
    ctaLabel: "Começar gratuitamente",
    description:
      "Operação essencial para publicar sua presença e organizar o início.",
    features: therapistPlanFeatureDefinitions
      .filter((feature) => feature.minimumPlan === TherapistPlan.Free)
      .map((feature) => feature.code),
    limits: {
      messages: 20,
      services: 1,
    },
    monthlyPriceCents: 0,
    name: "Free",
    priceLabel: "R$ 0",
    priceNote: "Comece sua jornada",
    signupHref: getPlanSignupHref(TherapistPlan.Free),
    stripePriceId: null,
    subtitle: "Comece sua jornada",
  },
  {
    code: TherapistPlan.Premium,
    ctaLabel: "Escolher Premium",
    description:
      "Métricas com leitura direcional, insights de agenda e solicitação de nova terapia.",
    features: therapistPlanFeatureDefinitions
      .filter((feature) => feature.minimumPlan !== TherapistPlan.PremiumPlus)
      .map((feature) => feature.code),
    highlight: true,
    limits: {
      messages: 100,
      services: 6,
    },
    monthlyPriceCents: 6000,
    name: "Premium",
    priceLabel: "R$ 60/mês",
    priceNote: "Cobrança mensal recorrente",
    signupHref: getPlanSignupHref(TherapistPlan.Premium),
    stripePriceId: null,
    subtitle: "Fortaleça sua presença",
  },
  {
    code: TherapistPlan.PremiumPlus,
    ctaLabel: "Escolher Premium Plus",
    description:
      "Mais recursos para acompanhar seu trabalho, seus recebimentos e suas escolhas.",
    features: therapistPlanFeatureDefinitions.map((feature) => feature.code),
    limits: {
      services: undefined,
    },
    monthlyPriceCents: 12000,
    name: "Premium Plus",
    priceLabel: "R$ 120/mês",
    priceNote: "Cobrança mensal recorrente",
    signupHref: getPlanSignupHref(TherapistPlan.PremiumPlus),
    stripePriceId: null,
    subtitle: "Cuide do seu trabalho",
  },
];

export function getTherapistPlanDefinition(plan: TherapistPlan) {
  return (
    therapistPlanDefinitions.find((definition) => definition.code === plan) ??
    therapistPlanDefinitions[0]
  );
}

export function getPlanFeatureDefinition(code: PlanFeatureCode) {
  return therapistPlanFeatureDefinitions.find(
    (feature) => feature.code === code,
  );
}

export function planIncludesFeature(
  plan: TherapistPlan,
  featureCode: PlanFeatureCode,
) {
  return getTherapistPlanDefinition(plan).features.includes(featureCode);
}
