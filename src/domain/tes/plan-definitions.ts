import { routes } from "@/lib/routes";

import { TherapistPlan } from "./enums";
import type { TherapistCapability } from "./permissions";

export type PlanFeatureCode =
  | "public_profile"
  | "secure_platform"
  | "online_sessions"
  | "integrated_payments"
  | "essential_messages"
  | "service_catalog"
  | "advanced_metrics"
  | "rule_based_suggestions"
  | "agenda_insights"
  | "request_new_therapy"
  | "profile_reports"
  | "full_crm"
  | "strategic_reviews"
  | "advanced_financials"
  | "operational_summary"
  | "complete_recommendations";

export type PlanFeatureCategory = "base" | "premium" | "premium_plus";

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
    code: "public_profile",
    description: "Perfil publico, apresentacao, textos e links para apoiar sua presenca.",
    label: "Perfil publico profissional",
    minimumPlan: TherapistPlan.Free,
    capability: "operation_essentials",
  },
  {
    category: "base",
    code: "secure_platform",
    description: "Ambiente com acesso autenticado, regras de privacidade e operacao segura.",
    label: "Plataforma segura",
    minimumPlan: TherapistPlan.Free,
    capability: "operation_essentials",
  },
  {
    category: "base",
    code: "online_sessions",
    description: "Organizacao de sessoes online dentro do fluxo da plataforma.",
    label: "Atendimentos online",
    minimumPlan: TherapistPlan.Free,
    capability: "operation_essentials",
  },
  {
    category: "base",
    code: "integrated_payments",
    description: "Preparado para pagamentos integrados sem misturar assinatura e sessoes.",
    label: "Pagamentos integrados",
    minimumPlan: TherapistPlan.Free,
    capability: "operation_essentials",
  },
  {
    category: "base",
    code: "essential_messages",
    description: "Mensagens essenciais para organizar a relacao de cuidado.",
    label: "Mensagens essenciais",
    minimumPlan: TherapistPlan.Free,
    capability: "operation_essentials",
  },
  {
    category: "base",
    code: "service_catalog",
    description: "Catalogo de servicos com limites por plano e curadoria da plataforma.",
    label: "Servicos publicados",
    minimumPlan: TherapistPlan.Free,
    capability: "operation_essentials",
  },
  {
    category: "premium",
    code: "advanced_metrics",
    description: "Indicadores para acompanhar descoberta, perfil e rotina profissional.",
    label: "Metricas avancadas",
    minimumPlan: TherapistPlan.Premium,
    capability: "advanced_metrics",
  },
  {
    category: "premium",
    code: "rule_based_suggestions",
    description: "Sugestoes baseadas em regras para melhorar operacao e presenca.",
    label: "Sugestoes baseadas em regras",
    minimumPlan: TherapistPlan.Premium,
    capability: "aura_limited",
  },
  {
    category: "premium",
    code: "agenda_insights",
    description: "Sinais de agenda para apoiar horarios, procura e consistencia.",
    label: "Insights de agenda",
    minimumPlan: TherapistPlan.Premium,
    capability: "agenda_insights",
  },
  {
    category: "premium",
    code: "request_new_therapy",
    description: "Solicitacao de nova terapia para avaliacao da curadoria/admin.",
    label: "Solicitar nova terapia",
    minimumPlan: TherapistPlan.Premium,
    capability: "request_new_therapy",
  },
  {
    category: "premium",
    code: "profile_reports",
    description: "Relatorios de perfil para entender caminhos de descoberta.",
    label: "Relatorios de perfil",
    minimumPlan: TherapistPlan.Premium,
    capability: "advanced_metrics",
  },
  {
    category: "premium_plus",
    code: "full_crm",
    description: "Organizacao ampliada do relacionamento com pacientes na plataforma.",
    label: "CRM completo",
    minimumPlan: TherapistPlan.PremiumPlus,
    capability: "full_crm",
  },
  {
    category: "premium_plus",
    code: "strategic_reviews",
    description: "Leitura estruturada das avaliacoes publicadas e pontos de atencao.",
    label: "Avaliacoes estrategicas",
    minimumPlan: TherapistPlan.PremiumPlus,
    capability: "strategic_reviews",
  },
  {
    category: "premium_plus",
    code: "advanced_financials",
    description: "Visao financeira avancada sem alterar a comissao de sessoes por plano.",
    label: "Financeiro avancado",
    minimumPlan: TherapistPlan.PremiumPlus,
    capability: "advanced_financials",
  },
  {
    category: "premium_plus",
    code: "operational_summary",
    description: "Resumo operacional automatico a partir de dados da plataforma.",
    label: "Resumo operacional automatico",
    minimumPlan: TherapistPlan.PremiumPlus,
    capability: "aura_full",
  },
  {
    category: "premium_plus",
    code: "complete_recommendations",
    description: "Recomendacoes completas baseadas em regras e sinais operacionais.",
    label: "Recomendacoes completas",
    minimumPlan: TherapistPlan.PremiumPlus,
    capability: "aura_full",
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
    subtitle: "Base para iniciar",
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
    subtitle: "Para crescer com clareza",
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
    subtitle: "Para operar com mais profundidade",
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
