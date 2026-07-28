import {
  CalendarCheck,
  ChartNoAxesColumnIncreasing,
  CreditCard,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";

export const forTherapistsHero = {
  eyebrow: "PARA TERAPEUTAS",
  title: "Você cuida de pessoas.",
  accent: "Nos cuidamos do espaco onde esse encontro acontece",
  body: "O TES foi criado para ajudar terapeutas a organizar atendimentos, fortalecer sua presenca e construir uma jornada profissional com mais clareza e tranquilidade.",
  primaryCta: "Quero me cadastrar",
  secondaryCta: "Ver planos",
};

export const trustItems = [
  {
    icon: ShieldCheck,
    label: "Ambiente seguro e privado",
  },
  {
    icon: CalendarCheck,
    label: "Atendimento dentro da plataforma",
  },
  {
    icon: UserRoundCheck,
    label: "Perfis verificados",
  },
  {
    icon: CreditCard,
    label: "Pagamentos integrados",
  },
];

export const benefitCards = [
  {
    body: "Seu perfil profissional, sua historia e sua forma de trabalhar em um espaco que ajuda a mostrar sua abordagem com clareza.",
    icon: UserRoundCheck,
    title: "Mostre quem voce e e como cuida das pessoas",
    variant: "profile",
  },
  {
    body: "Agendas, sessoes, pagamentos, mensagens e informacoes organizadas.",
    icon: CalendarCheck,
    title: "Centralize tudo em um so lugar",
    variant: "calendar",
  },
  {
    body: "Perfis verificados, privacidade e regras de plataforma para apoiar uma relacao de cuidado responsavel.",
    icon: ShieldCheck,
    title: "Presenca profissional com seguranca",
    variant: "security",
  },
  {
    body: "Fluxos separados para assinatura e sessoes, mantendo clareza operacional e financeira.",
    icon: LockKeyhole,
    title: "Pagamentos seguros",
    variant: "payments",
  },
  {
    body: "Mensagens e acompanhamento para manter sua rotina mais organizada antes e depois das sessoes.",
    icon: MessageCircle,
    title: "Seja encontrada por quem procura voce",
    variant: "community",
  },
  {
    body: "Metricas e sinais de descoberta para acompanhar sua evolucao sem prometer resultado financeiro.",
    icon: ChartNoAxesColumnIncreasing,
    title: "Acompanhe sua evolucao",
    variant: "growth",
  },
  {
    body: "Converse, organize atendimentos online e acompanhe sua agenda de qualquer lugar com seguranca.",
    icon: Sparkles,
    title: "Atenda de onde estiver",
    variant: "remote",
  },
];

export const planCategoryLabels = {
  base: "Operação — base de todos",
  premium: "Identidade & presença — a partir do Premium",
  premium_plus: "Gestão da prática — exclusivo Premium Plus",
  academy: "Academia TES (Em breve)",
} as const;

export const commercialNotes = [
  "Valores pagos aparecem como referencia inicial e podem ser confirmados no cadastro/checkout.",
  "Assinatura do terapeuta e pagamentos de sessoes sao fluxos separados.",
  "A liberacao de plano futura deve acontecer apenas por webhook Stripe idempotente.",
];
