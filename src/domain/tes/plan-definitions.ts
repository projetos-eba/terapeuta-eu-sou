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
      "Agenda, bloqueios e horários essenciais para operar dentro da plataforma.",
    label: "Agenda, bloqueio de dias e horários",
    minimumPlan: TherapistPlan.Free,
    capability: "operation_essentials",
  },
  {
    category: "base",
    code: "profile_focus_cover_bio",
    description:
      "Dados editoriais básicos para apresentar o perfil profissional.",
    label: "Foto, capa, bio, especialidades",
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
    description:
      "Confirmação operacional automática para consultas dentro do portal.",
    label: "Confirmação automática de consulta",
    minimumPlan: TherapistPlan.Free,
    capability: "operation_essentials",
  },
  {
    category: "base",
    code: "closed_portal_sessions",
    description: "Atendimento organizado no ambiente fechado do portal.",
    label: "Atendimento no ambiente fechado do portal",
    minimumPlan: TherapistPlan.Free,
    capability: "operation_essentials",
  },
  {
    category: "premium",
    code: "username_url",
    description: "URL personalizada com o nome público do terapeuta.",
    label: "URL com o seu nome (/seunome)",
    minimumPlan: TherapistPlan.Premium,
  },
  {
    category: "premium",
    code: "visual_identity_customization",
    description: "Personalização visual da presença pública.",
    label: "Personalização visual (identidade própria)",
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
    description: "Lembretes operacionais automáticos em automação parcial.",
    label: "Lembretes automáticos (automação parcial)",
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
    description: "Aura conforme recursos disponíveis no plano.",
    minimumPlan: TherapistPlan.PremiumPlus,
    label: "Aura",
    capability: "aura_full",
  },
  {
    category: "premium_plus",
    code: "complete_financial_dashboard",
    description:
      "Dashboard financeiro completo sem alterar comissão por plano.",
    label: "Dashboard financeiro completo",
    minimumPlan: TherapistPlan.PremiumPlus,
    capability: "advanced_financials",
  },
  {
    category: "premium_plus",
    code: "complete_message_automation",
    description:
      "Automação completa de mensagens conforme regras da plataforma.",
    label: "Automação de mensagens completa",
    minimumPlan: TherapistPlan.PremiumPlus,
    capability: "aura_full",
  },
  {
    category: "premium_plus",
    code: "journey_history_crm",
    description: "Histórico da Jornada em formato CRM operacional.",
    label: "Histórico da Jornada (CRM)",
    minimumPlan: TherapistPlan.PremiumPlus,
    capability: "full_crm",
  },
  {
    category: "premium_plus",
    code: "advanced_badge_system",
    description: "Sistema de selos avançado conforme curadoria da plataforma.",
    label: "Sistema de selos avançado",
    minimumPlan: TherapistPlan.PremiumPlus,
  },
  {
    category: "premium_plus",
    code: "seasonal_campaigns",
    description: "Participação futura em campanhas sazonais.",
    label: "Participação em campanhas sazonais (Em breve)",
    minimumPlan: TherapistPlan.PremiumPlus,
  },
  {
    category: "academy",
    code: "tes_academy",
    description: "Academia TES prevista para evolução futura dos planos.",
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
      "CRM completo, avaliações estratégicas, financeiro avançado e recomendações completas.",
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
    subtitle: "Gerencie sua prática",
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
