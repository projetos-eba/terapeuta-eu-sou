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
  primaryCta: "Criar meu perfil",
  secondaryCta: "Ver planos",
};

export const trustItems = [
  {
    icon: ShieldCheck,
    label: "Privacidade e cuidado com seus dados​",
  },
  {
    icon: CalendarCheck,
    label: "Atendimento pela plataforma",
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
    title: "Mostre quem você é e como trabalha",
    variant: "profile",
  },
  {
    body: "Agenda, encontros, pagamentos, mensagens e informações importantes reunidos para facilitar seu dia a dia.​",
    icon: CalendarCheck,
    title: "Organize sua rotina em um só lugar​",
    variant: "calendar",
  },
  {
    body: "Perfil verificado, informações organizadas e regras da plataforma para apoiar uma relação mais clara e responsável com quem chega até você.​",
    icon: ShieldCheck,
    title: "Presença profissional com segurança",
    variant: "security",
  },
  {
    body: "Acompanhe seus recebimentos e movimentações com informações claras dentro da plataforma.​",
    icon: LockKeyhole,
    title: "Pagamentos organizados",
    variant: "payments",
  },
  {
    body: "Seu perfil pode aparecer para pessoas que estão explorando práticas e profissionais dentro do TES.​",
    icon: MessageCircle,
    title: "Seja encontrada por quem busca o que você oferece​",
    variant: "community",
  },
  {
    body: "Veja sinais e informações sobre sua presença na plataforma para entender melhor como seu perfil está sendo encontrado e acessado.​",
    icon: ChartNoAxesColumnIncreasing,
    title: "Acompanhe sua presença no TES​",
    variant: "growth",
  },
  {
    body: "Converse, organize seus encontros online e acompanhe sua agenda pela plataforma, de onde estiver.​",
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
  "A ativação dos planos pagos acontece após a confirmação do pagamento.",
];
