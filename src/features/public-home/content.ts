import { routes } from "@/lib/routes";

import type {
  PublicHomeFaq,
  PublicHomeReason,
  PublicHomeStep,
  PublicHomeTestimonial,
  PublicHomeTherapist,
  PublicHomeTherapy,
} from "./types";

export const homeHero = {
  eyebrow: "CUIDADO QUE ACOLHE. CONEXÃO QUE TRANSFORMA.",
  titleStart: "Entre uma pergunta e um novo caminho",
  titleAccent: "existe um encontro",
  body: "O TES conecta você a terapeutas, práticas e experiências que podem apoiar diferentes momentos da vida. Aqui, cada jornada é única. E cada encontro pode fazer sentido para você.",
  primaryCta: {
    label: "Começar minha jornada",
    href: routes.public.journey,
  },
  secondaryCta: {
    label: "Explorar terapias",
    href: routes.public.therapies,
  },
};

export const homeIntroCards = [
  {
    title: "Para todas as jornadas",
    body: "Seja qual for a sua busca, você encontra informação, acolhimento e caminhos possíveis.",
  },
  {
    title: "Variedade de práticas",
    body: "Diferentes abordagens e terapias para apoiar o momento que você está vivendo.",
  },
  {
    title: "Segurança e cuidado",
    body: "Um ambiente protegido, com perfis verificados e linguagem responsável.",
  },
  {
    title: "Escolha com clareza",
    body: "Informações e ferramentas para decidir com calma, sem pressa e sem promessa de resultado.",
  },
];

export const homeSteps: PublicHomeStep[] = [
  {
    title: "Conte o que você está vivendo",
    body: "Expresse suas perguntas, sentimentos e o que faz sentido no momento.",
    image: "/home/step-mirror.png",
  },
  {
    title: "Descubra caminhos terapêuticos",
    body: "Navegue por terapias, abordagens e perfis de profissionais que podem apoiar sua jornada.",
    image: "/home/step-crystal.png",
  },
  {
    title: "Escolha um terapeuta",
    body: "Conheça perfis verificados, veja avaliações publicadas e escolha com mais confiança.",
    image: "/home/step-choice.png",
  },
  {
    title: "Agende e viva o processo",
    body: "Marque sua sessão online e inicie uma jornada de cuidado no seu tempo.",
    image: "/home/step-calendar.png",
  },
];

export const homeReasons: PublicHomeReason[] = [
  {
    title: "Autoconhecimento",
    body: "Compreender padrões, emoções e escolhas para se escutar com mais presença.",
    tone: "green",
  },
  {
    title: "Espiritualidade",
    body: "Explorar perspectivas e conexões com o que faz sentido para você.",
    tone: "purple",
  },
  {
    title: "Equilíbrio",
    body: "Encontrar mais pausa, leveza e alinhamento no dia a dia.",
    tone: "blue",
  },
  {
    title: "Relacionamentos",
    body: "Refletir sobre vínculos, dinâmicas e comunicação com mais consciência.",
    tone: "pink",
  },
  {
    title: "Propósito",
    body: "Olhar para o futuro com mais clareza e direção na sua jornada.",
    tone: "orange",
  },
];

export const fallbackTherapies: PublicHomeTherapy[] = [
  {
    name: "Reiki",
    slug: "reiki",
    categoryName: "Energia e Equilíbrio Energético",
    imageUrl: "/therapies/reiki-editorial.png",
    shortDescription:
      "Uma prática complementar para desacelerar e reservar um tempo de presença.",
    isFeatured: true,
    href: routes.public.therapyDetail("reiki"),
  },
  {
    name: "Tarô",
    slug: "taro",
    categoryName: "Autoconhecimento e Transformação",
    imageUrl: "/therapies/taro-editorial.png",
    shortDescription:
      "Uma leitura simbólica para refletir sobre escolhas, caminhos e perguntas internas.",
    isFeatured: false,
    href: routes.public.therapyDetail("taro"),
  },
  {
    name: "Constelação Familiar",
    slug: "constelacao-familiar",
    categoryName: "Relacionamentos",
    imageUrl: "/therapies/constelacao-familiar-editorial.png",
    shortDescription:
      "Uma experiência simbólica para observar vínculos e padrões com cuidado.",
    isFeatured: false,
    href: routes.public.therapyDetail("constelacao-familiar"),
  },
];

export const fallbackTherapists: PublicHomeTherapist[] = [
  {
    name: "Ana Oliveira",
    slug: "ana-oliveira",
    headline: "Terapeuta Integrativa",
    serviceTitle: "Sessão online individual",
    therapyNames: ["Reiki", "Aromaterapia"],
    guideItems: [
      "Clareza emocional",
      "Equilíbrio energético",
      "Reconexão interior",
      "Propósito e direção",
      "Relacionamentos conscientes",
      "Transições de vida",
    ],
    photoUrl: "/therapists/ana-oliveira.png",
    priceLabel: "A partir de R$ 120",
    ratingLabel: "4,9",
    reviewCountLabel: "98 avaliações",
    href: routes.public.therapistProfile("ana-oliveira"),
  },
  {
    name: "Rafael Santos",
    slug: "rafael-santos",
    headline: "Terapeuta Holístico",
    serviceTitle: "Acolhimento para mudanças de vida",
    therapyNames: ["Tarô"],
    photoUrl: "/therapists/rafael-santos-avatar.png",
    priceLabel: "A partir de R$ 120",
    ratingLabel: "4,8",
    reviewCountLabel: "74 avaliações",
    href: routes.public.therapistProfile("rafael-santos"),
  },
  {
    name: "Célia Martins",
    slug: "celia-martins",
    headline: "Terapeuta Integrativa",
    serviceTitle: "Escuta para relações e transformações",
    therapyNames: ["Constelação Familiar"],
    photoUrl: "/therapists/celia-martins.png",
    priceLabel: "A partir de R$ 120",
    ratingLabel: "4,9",
    reviewCountLabel: "112 avaliações",
    href: routes.public.therapistProfile("celia-martins"),
  },
  {
    name: "Juliana Costa",
    slug: "juliana-costa",
    headline: "Terapeuta Holística",
    serviceTitle: "Apoio para diálogos mais leves",
    therapyNames: ["Constelação Familiar"],
    photoUrl: "/therapists/juliana-costa.png",
    priceLabel: "A partir de R$ 120",
    ratingLabel: "4,8",
    reviewCountLabel: "88 avaliações",
    href: routes.public.therapistProfile("juliana-costa"),
  },
  {
    name: "Lucas Pereira",
    slug: "lucas-pereira",
    headline: "Tarô",
    serviceTitle: "Autoconhecimento, propósito e mudanças de vida",
    therapyNames: ["Tarô"],
    photoUrl: "/therapists/lucas-pereira-avatar.png",
    priceLabel: "A partir de R$ 170",
    ratingLabel: "5,0",
    reviewCountLabel: "1 avaliação",
    href: routes.public.therapistProfile("lucas-pereira"),
  },
];

export const fallbackTestimonials: PublicHomeTestimonial[] = [
  {
    body: "Encontrar a terapeuta certa mudou minha forma de me relacionar comigo mesma. A plataforma é prática, segura e acolhedora.",
    author: "Carlos Almeida",
    context: "Paciente há 3 meses",
    ratingLabel: "5,0",
  },
  {
    body: "As sessões online me deram o acolhimento que eu precisava, no meu tempo e no meu espaço.",
    author: "Roberto Firminio",
    context: "Paciente há 5 meses",
    ratingLabel: "5,0",
  },
  {
    body: "Consegui comparar perfis e escolher com calma. Isso fez diferença para começar.",
    author: "Mariana Ribeiro",
    context: "Paciente há 2 meses",
    ratingLabel: "5,0",
  },
];

export const homeFaqs: PublicHomeFaq[] = [
  {
    question: "Como funciona o TES?",
    answer:
      "Você explora caminhos terapêuticos, conhece perfis de terapeutas, escolhe um horário e segue para a reserva online quando fizer sentido.",
  },
  {
    question: "A plataforma é segura?",
    answer:
      "A experiência pública mostra apenas informações necessárias para a escolha. Dados sensíveis e dados de sessão devem seguir as regras de RLS e privacidade do projeto.",
  },
  {
    question: "Como escolho a terapeuta ideal para mim?",
    answer:
      "Você pode iniciar pela jornada guiada, explorar terapias ou comparar perfis. A escolha deve acontecer com calma, sem promessa de resultado.",
  },
  {
    question: "A sessão é online?",
    answer:
      "O fluxo público apresenta sessões online. O link da sessão só deve ser gerado após pagamento confirmado pelas regras transacionais do projeto.",
  },
  {
    question: "Posso reagendar se necessário?",
    answer:
      "As regras de reagendamento devem aparecer no fluxo de reserva e na área logada, conforme políticas do produto.",
  },
  {
    question: "O TES substitui acompanhamento médico?",
    answer:
      "Não. O conteúdo do TES é informativo e não substitui acompanhamento médico, psicológico, diagnóstico ou tratamento profissional.",
  },
];
