import {
  CalendarCheck,
  ChartNoAxesColumnIncreasing,
  Coins,
  CreditCard,
  Heart,
  LockKeyhole,
  Megaphone,
  MessageCircle,
  Settings,
  ShieldCheck,
  Sparkles,
  Sprout,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

export type TherapistExplainerAccordion = {
  accent: {
    body: string;
    label: string;
    title: string;
  };
  decorativeImage: string;
  eyebrow: string;
  id: "alcance" | "parceria";
  imageClassName: string;
  intro: {
    body: string;
    title: string;
  };
  items: Array<{
    body: string;
    icon: LucideIcon;
    title: string;
  }>;
  number: string;
  subtitle: string;
  title: string;
};

export const therapistExplainerAccordions: TherapistExplainerAccordion[] = [
  {
    accent: {
      body: "Muito do trabalho para que esse encontro seja possível acontece antes mesmo de a pessoa entrar no TES.",
      label: "Conexões que transformam",
      title: "Porque antes de existir um agendamento, precisa existir um encontro.",
    },
    decorativeImage: "/therapists/profile-bio/warm-chair.png",
    eyebrow: "Mais pessoas encontrando caminhos. Mais encontros com sentido.",
    id: "alcance",
    imageClassName: "object-contain object-bottom object-center",
    intro: {
      body: "Enquanto você se dedica aos seus atendimentos, existe uma estrutura trabalhando para que mais pessoas conheçam o TES, cheguem até a plataforma e possam encontrar profissionais que façam sentido para o que estão buscando.",
      title:
        "Antes de um encontro acontecer, existe todo um trabalho para torná-lo possível.",
    },
    items: [
      {
        body: "Investimos em divulgação, campanhas e anúncios patrocinados para ampliar a presença do TES e alcançar pessoas que estão buscando cuidado e desenvolvimento.",
        icon: Megaphone,
        title: "Fazer o TES chegar a mais pessoas",
      },
      {
        body: "Profissionais de comunicação, marketing e tráfego pago trabalham nos bastidores, planejando e acompanhando ações para fortalecer a presença do TES e conectar nossa proposta ao público certo.",
        icon: ChartNoAxesColumnIncreasing,
        title: "Estratégia por trás desse alcance",
      },
      {
        body: "Não basta uma pessoa conhecer o TES. Construímos caminhos para que ela possa chegar à plataforma, conhecer os profissionais, suas abordagens e especialidades e encontrar alguém com quem se identifique.",
        icon: UsersRound,
        title: "Transformar alcance em descoberta",
      },
      {
        body: "Marca, conteúdo, comunicação, tecnologia e experiência também fazem parte desse trabalho. Cada ponto de contato ajuda a construir um ambiente em que a pessoa possa conhecer o TES e seguir sua jornada com mais clareza e segurança.",
        icon: ShieldCheck,
        title: "Construir confiança para o encontro acontecer",
      },
    ],
    number: "1",
    subtitle:
      "Descubra como o TES trabalha dentro e fora da plataforma para aproximar pessoas de você.",
    title: "O que acontece antes de um atendimento chegar até você?",
  },
  {
    accent: {
      body: "É assim que construímos uma parceria em que cada atendimento também ajuda a manter e fortalecer o caminho que aproxima pessoas e terapeutas.",
      label: "Parcerias que fazem sentido",
      title:
        "Você cuida do encontro. O TES cuida da estrutura que ajuda esse encontro a acontecer.",
    },
    decorativeImage: "/therapists/profile-bio/natural-plant.png",
    eyebrow: "Você cuida do encontro. O TES cuida do caminho.",
    id: "parceria",
    imageClassName: "object-contain object-bottom object-right",
    intro: {
      body: "O TES constrói e mantém uma estrutura para aproximar pessoas e terapeutas e para que essa jornada possa continuar dentro da plataforma, do encontro com o profissional ao atendimento. Quando uma sessão é contratada e paga pelo TES, essa parceria também funciona de forma simples e transparente.",
      title: "Uma parceria que funciona junto com cada atendimento.",
    },
    items: [
      {
        body: "Em cada atendimento contratado e pago pela plataforma, 85% do valor efetivamente cobrado é destinado a você e 15% fica com o TES. Essa comissão é a mesma em todos os planos.",
        icon: Coins,
        title: "Quando uma sessão acontece pelo TES",
      },
      {
        body: "A comissão faz parte da sustentação da infraestrutura, da intermediação e dos serviços oferecidos pelo TES — além de todo o trabalho que apresentamos anteriormente para fortalecer o ecossistema e aproximar pessoas e terapeutas.",
        icon: Settings,
        title: "O que mantém essa estrutura acontecendo",
      },
      {
        body: "Após a confirmação da cobrança, o valor do seu atendimento segue o fluxo de processamento do pagamento. O prazo para ficar disponível varia conforme o meio de pagamento utilizado e, quando disponível, o valor é enviado automaticamente para a conta bancária cadastrada por você.",
        icon: CreditCard,
        title: "Como funciona o recebimento dos seus atendimentos",
      },
    ],
    number: "2",
    subtitle: "Entenda como o TES e você caminham juntos a cada atendimento.",
    title: "Como funciona essa parceria na prática?",
  },
];

export const therapistExplainerAccentIcons = {
  alcance: Heart,
  parceria: Sprout,
} as const;

export const therapistFaqItems = [
  {
    answer:
      "Sim. O TES possui o plano Free, com mensalidade de R$ 0, para você começar sua jornada. Se quiser acessar outros recursos, também poderá escolher um dos planos pagos.",
    question: "O cadastro é realmente gratuito?",
  },
  {
    answer:
      "Não. Não existe uma formação específica obrigatória para se cadastrar no TES. Caso você tenha uma formação, poderá informá-la no seu perfil profissional.",
    question: "Preciso ter formação específica para me cadastrar?",
  },
  {
    answer:
      "Do agendamento à sessão, tudo acontece dentro do TES. Você organiza sua disponibilidade, recebe os agendamentos e realiza seus atendimentos online pela plataforma.",
    question: "Como funcionam os atendimentos pelo TES?",
  },
  {
    answer:
      "O TES possui os planos Premium e Premium Plus, com recursos e benefícios diferentes para cada momento da sua jornada. Você pode comparar tudo o que cada plano oferece na tabela acima.",
    question: "Como funcionam os planos pagos?",
  },
  {
    answer:
      "Você. Cada terapeuta define o valor do próprio atendimento dentro do TES.",
    question: "Quem define o valor da minha sessão?",
  },
  {
    answer:
      "Após a confirmação da cobrança, o valor do seu atendimento segue o fluxo de processamento do pagamento. O prazo para ficar disponível varia conforme o meio de pagamento utilizado e, quando disponível, o valor é enviado automaticamente para a conta bancária cadastrada por você. Você encontra todos os detalhes sobre prazos e recebimentos nos Termos de Uso do TES.",
    question: "Quando e como recebo pelos atendimentos?",
  },
] as const;
