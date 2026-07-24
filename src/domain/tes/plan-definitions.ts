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

export type PlanFeatureCategory = "base" | "premium" | "premium_plus" | "academy";

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
    description: "Agenda, bloqueios e horarios essenciais para operar dentro da plataforma.",
    label: "Agenda, bloqueio de dias e horarios",
    minimumPlan: TherapistPlan.Free,
    capability: "operation_essentials",
  },
  {
    category: "base",
    code: "profile_focus_cover_bio",
    description: "Dados editoriais basicos para apresentar o perfil profissional.",
    label: "Foto, capa, bio, especialidades",
    minimumPlan: TherapistPlan.Free,
    capability: "operation_essentials",
  },
  {
    category: "base",
    code: "shareable_public_profile",
    description: "Perfil publico com link para compartilhamento.",
    label: "Perfil publico + link para compartilhar",
    minimumPlan: TherapistPlan.Free,
    capability: "operation_essentials",
  },
  {
    category: "base",
    code: "automatic_consultation_confirmation",
    description: "Confirmacao operacional automatica para consultas dentro do portal.",
    label: "Confirmacao automatica de consulta",
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
    description: "URL personalizada com o nome publico do terapeuta.",
    label: "URL com o seu nome (/seunome)",
    minimumPlan: TherapistPlan.Premium,
  },
  {
    category: "premium",
    code: "visual_identity_customization",
    description: "Personalizacao visual da presenca publica.",
    label: "Personalizacao visual (identidade propria)",
    minimumPlan: TherapistPlan.Premium,
  },
  {
    category: "premium",
    code: "reviews_testimonials",
    description: "Avaliacoes publicadas e depoimentos moderados.",
    label: "Avaliacoes e depoimentos",
    minimumPlan: TherapistPlan.Premium,
  },
  {
    category: "premium",
    code: "verification_badge",
    description: "Selo de verificacao exibido conforme regras da plataforma.",
    label: "Selo de verificacao",
    minimumPlan: TherapistPlan.Premium,
  },
  {
    category: "premium",
    code: "automatic_reminders_partial",
    description: "Lembretes operacionais automaticos em automacao parcial.",
    label: "Lembretes automaticos (automacao parcial)",
    minimumPlan: TherapistPlan.Premium,
    capability: "agenda_insights",
  },
  {
    category: "premium",
    code: "search_visibility",
    description: "Destaque de visibilidade dentro das regras de busca da plataforma.",
    label: "Visibilidade na busca",
    minimumPlan: TherapistPlan.Premium,
  },
  {
    category: "premium",
    code: "profile_metrics",
    description: "Metricas do perfil, como visitas e cliques.",
    label: "Metricas do perfil (visitas, cliques)",
    minimumPlan: TherapistPlan.Premium,
    capability: "advanced_metrics",
  },
  {
    category: "premium_plus",
    code: "short_videos_presentation_video",
    description: "Videos curtos e video de apresentacao do perfil.",
    label: "Videos curtos / video de apresentacao",
    minimumPlan: TherapistPlan.PremiumPlus,
  },
  {
    category: "premium_plus",
    code: "aura",
    description: "Aura conforme recursos disponiveis no plano.",
    minimumPlan: TherapistPlan.PremiumPlus,
    label: "Aura",
    capability: "aura_full",
  },
  {
    category: "premium_plus",
    code: "complete_financial_dashboard",
    description: "Dashboard financeiro completo sem alterar comissao por plano.",
    label: "Dashboard financeiro completo",
    minimumPlan: TherapistPlan.PremiumPlus,
    capability: "advanced_financials",
  },
  {
    category: "premium_plus",
    code: "complete_message_automation",
    description: "Automacao completa de mensagens conforme regras da plataforma.",
    label: "Automacao de mensagens completa",
    minimumPlan: TherapistPlan.PremiumPlus,
    capability: "aura_full",
  },
  {
    category: "premium_plus",
    code: "journey_history_crm",
    description: "Historico da Jornada em formato CRM operacional.",
    label: "Historico da Jornada (CRM)",
    minimumPlan: TherapistPlan.PremiumPlus,
    capability: "full_crm",
  },
  {
    category: "premium_plus",
    code: "advanced_badge_system",
    description: "Sistema de selos avancado conforme curadoria da plataforma.",
    label: "Sistema de selos avancado",
    minimumPlan: TherapistPlan.PremiumPlus,
  },
  {
    category: "premium_plus",
    code: "seasonal_campaigns",
    description: "Participacao futura em campanhas sazonais.",
    label: "Participacao em campanhas sazonais (Em breve)",
    minimumPlan: TherapistPlan.PremiumPlus,
  },
  {
    category: "academy",
    code: "tes_academy",
    description: "Academia TES prevista para evolucao futura dos planos.",
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
    ctaLabel: "Comecar gratuitamente",
    description: "Operacao essencial para publicar sua presenca e organizar o inicio.",
    features: therapistPlanFeatureDefinitions
      .filter((feature) => feature.minimumPlan === TherapistPlan.Free)
      .map((feature) => feature.code),
    limits: {
      messages: 20,
      services: 1,
    },
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
      "Metricas, recomendacoes limitadas, insights de agenda e solicitacao de nova terapia.",
    features: therapistPlanFeatureDefinitions
      .filter((feature) => feature.minimumPlan !== TherapistPlan.PremiumPlus)
      .map((feature) => feature.code),
    highlight: true,
    limits: {
      messages: 100,
      services: 6,
    },
    name: "Premium",
    priceLabel: "A partir de R$ 59/mes",
    priceNote: "Preco e limites confirmados no cadastro",
    signupHref: getPlanSignupHref(TherapistPlan.Premium),
    stripePriceId: null,
    subtitle: "Fortaleça sua presença",
  },
  {
    code: TherapistPlan.PremiumPlus,
    ctaLabel: "Escolher Premium Plus",
    description:
      "CRM completo, avaliacoes estrategicas, financeiro avancado e recomendacoes completas.",
    features: therapistPlanFeatureDefinitions.map((feature) => feature.code),
    limits: {
      services: undefined,
    },
    name: "Premium Plus",
    priceLabel: "A partir de R$ 149/mes",
    priceNote: "Recursos completos sujeitos a politica de uso",
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
  return therapistPlanFeatureDefinitions.find((feature) => feature.code === code);
}

export function planIncludesFeature(
  plan: TherapistPlan,
  featureCode: PlanFeatureCode,
) {
  return getTherapistPlanDefinition(plan).features.includes(featureCode);
}
