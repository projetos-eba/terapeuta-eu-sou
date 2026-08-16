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
  accent: "Nós cuidamos do espaço onde esse encontro acontece",
  body: "O TES foi criado para ajudar terapeutas a organizar atendimentos, fortalecer sua presença e construir uma jornada profissional com mais clareza e tranquilidade.",
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
    body: "Seu perfil profissional, sua história e sua forma de trabalhar em um espaço que ajuda a mostrar sua abordagem com clareza.",
    icon: UserRoundCheck,
    title: "Mostre quem você é e como cuida das pessoas",
    variant: "profile",
  },
  {
    body: "Agenda, sessões, pagamentos, mensagens e informações organizadas.",
    icon: CalendarCheck,
    title: "Centralize tudo em um só lugar",
    variant: "calendar",
  },
  {
    body: "Perfis verificados, privacidade e regras da plataforma para apoiar uma relação de cuidado responsável.",
    icon: ShieldCheck,
    title: "Presença profissional com segurança",
    variant: "security",
  },
  {
    body: "Fluxos separados para assinatura e sessões, mantendo clareza operacional e financeira.",
    icon: LockKeyhole,
    title: "Pagamentos seguros",
    variant: "payments",
  },
  {
    body: "Mensagens e acompanhamento para manter sua rotina mais organizada antes e depois das sessões.",
    icon: MessageCircle,
    title: "Seja encontrada por quem procura você",
    variant: "community",
  },
  {
    body: "Métricas e sinais de descoberta para acompanhar sua evolução sem prometer resultado financeiro.",
    icon: ChartNoAxesColumnIncreasing,
    title: "Acompanhe sua evolução",
    variant: "growth",
  },
  {
    body: "Converse, organize atendimentos online e acompanhe sua agenda de qualquer lugar com segurança.",
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
  "Valores pagos aparecem como referência inicial e podem ser confirmados no cadastro/checkout.",
  "A assinatura do terapeuta e os pagamentos de sessões são fluxos separados.",
  "A liberação futura de planos deve acontecer apenas por webhook Stripe idempotente.",
];
