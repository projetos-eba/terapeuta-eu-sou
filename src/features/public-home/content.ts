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
  eyebrow: "CUIDADO QUE ACOLHE. CONEXAO QUE TRANSFORMA.",
  titleStart: "Entre uma pergunta e um novo caminho",
  titleAccent: "existe um encontro",
  body: "O TES conecta voce a terapeutas, praticas e experiencias que podem apoiar diferentes momentos da vida. Aqui, cada jornada e unica. E cada encontro pode fazer sentido para voce.",
  primaryCta: {
    label: "Quero conhecer o TES",
    href: routes.public.howItWorks,
  },
  secondaryCta: {
    label: "Explorar terapias",
    href: routes.public.therapies,
  },
};

export const homeIntroCards = [
  {
    title: "Para todas as jornadas",
    body: "Seja qual for a sua busca, voce encontra informacao, acolhimento e caminhos possiveis.",
  },
  {
    title: "Variedade de praticas",
    body: "Diferentes abordagens e terapias para apoiar o momento que voce esta vivendo.",
  },
  {
    title: "Seguranca e cuidado",
    body: "Um ambiente protegido, com perfis verificados e linguagem responsavel.",
  },
  {
    title: "Escolha com clareza",
    body: "Informacoes e ferramentas para decidir com calma, sem pressa e sem promessa de resultado.",
  },
];

export const homeSteps: PublicHomeStep[] = [
  {
    title: "Conte o que voce esta vivendo",
    body: "Expresse suas perguntas, sentimentos e o que faz sentido no momento.",
    image: "/home/step-mirror.png",
  },
  {
    title: "Descubra caminhos terapeuticos",
    body: "Navegue por terapias, abordagens e perfis de profissionais que podem apoiar sua jornada.",
    image: "/home/step-crystal.png",
  },
  {
    title: "Escolha um terapeuta",
    body: "Conheca perfis verificados, veja avaliacoes publicadas e escolha com mais confianca.",
    image: "/home/step-choice.png",
  },
  {
    title: "Agende e viva o processo",
    body: "Marque sua sessao online e inicie uma jornada de cuidado no seu tempo.",
    image: "/home/step-calendar.png",
  },
];

export const homeReasons: PublicHomeReason[] = [
  {
    title: "Autoconhecimento",
    body: "Compreender padroes, emocoes e escolhas para se escutar com mais presenca.",
    tone: "green",
  },
  {
    title: "Espiritualidade",
    body: "Explorar perspectivas e conexoes com o que faz sentido para voce.",
    tone: "purple",
  },
  {
    title: "Equilibrio",
    body: "Encontrar mais pausa, leveza e alinhamento no dia a dia.",
    tone: "blue",
  },
  {
    title: "Relacionamentos",
    body: "Refletir sobre vinculos, dinamicas e comunicacao com mais consciencia.",
    tone: "pink",
  },
  {
    title: "Proposito",
    body: "Olhar para o futuro com mais clareza e direcao na sua jornada.",
    tone: "orange",
  },
];

export const fallbackTherapies: PublicHomeTherapy[] = [
  {
    name: "Terapia Integrativa",
    slug: "terapia-integrativa",
    categoryName: "Terapias Integrativas",
    shortDescription:
      "Um caminho amplo para organizar sentimentos, escolhas e momentos de transicao.",
    isFeatured: true,
    href: routes.public.therapyDetail("terapia-integrativa"),
  },
  {
    name: "Terapia Floral",
    slug: "terapia-floral",
    categoryName: "Terapias Integrativas",
    shortDescription:
      "Uma possibilidade para quem busca apoio em equilibrio emocional e autoconhecimento.",
    isFeatured: false,
    href: routes.public.therapyDetail("terapia-floral"),
  },
  {
    name: "Meditacao Guiada",
    slug: "meditacao-guiada",
    categoryName: "Praticas de Presenca",
    shortDescription:
      "Uma pratica para cultivar presenca, pausa e percepcao do proprio ritmo.",
    isFeatured: false,
    href: routes.public.therapyDetail("meditacao-guiada"),
  },
];

export const fallbackTherapists: PublicHomeTherapist[] = [
  {
    name: "Ana Oliveira",
    slug: "ana-oliveira",
    headline: "Terapeuta Integrativa",
    serviceTitle: "Sessao online individual",
    photoUrl: "/therapists/ana-oliveira.png",
    priceLabel: "A partir de R$ 120",
    ratingLabel: "4,9",
    reviewCountLabel: "98 avaliacoes",
    href: routes.public.therapistProfile("ana-oliveira"),
  },
  {
    name: "Rafael Santos",
    slug: "rafael-santos",
    headline: "Terapeuta Holistico",
    serviceTitle: "Acolhimento para mudancas de vida",
    photoUrl: "/therapists/rafael-santos.png",
    priceLabel: "A partir de R$ 120",
    ratingLabel: "4,8",
    reviewCountLabel: "74 avaliacoes",
    href: routes.public.therapistProfile("rafael-santos"),
  },
  {
    name: "Celia Martins",
    slug: "celia-martins",
    headline: "Terapeuta Integrativa",
    serviceTitle: "Escuta para relacoes e transformacoes",
    photoUrl: "/therapists/celia-martins.png",
    priceLabel: "A partir de R$ 120",
    ratingLabel: "4,9",
    reviewCountLabel: "112 avaliacoes",
    href: routes.public.therapistProfile("celia-martins"),
  },
  {
    name: "Juliana Costa",
    slug: "juliana-costa",
    headline: "Terapeuta Holistica",
    serviceTitle: "Apoio para dialogos mais leves",
    photoUrl: "/therapists/juliana-costa.png",
    priceLabel: "A partir de R$ 120",
    ratingLabel: "4,8",
    reviewCountLabel: "88 avaliacoes",
    href: routes.public.therapistProfile("juliana-costa"),
  },
];

export const fallbackTestimonials: PublicHomeTestimonial[] = [
  {
    body: "Encontrar a terapeuta certa mudou minha forma de me relacionar comigo mesma. A plataforma e pratica, segura e acolhedora.",
    author: "Carlos Almeida",
    context: "Paciente ha 3 meses",
    ratingLabel: "5,0",
  },
  {
    body: "As sessoes online me deram o acolhimento que eu precisava, no meu tempo e no meu espaco.",
    author: "Roberto Firminio",
    context: "Paciente ha 5 meses",
    ratingLabel: "5,0",
  },
  {
    body: "Consegui comparar perfis e escolher com calma. Isso fez diferenca para comecar.",
    author: "Mariana Ribeiro",
    context: "Paciente ha 2 meses",
    ratingLabel: "5,0",
  },
];

export const homeFaqs: PublicHomeFaq[] = [
  {
    question: "Como funciona o TES?",
    answer:
      "Voce explora caminhos terapeuticos, conhece perfis de terapeutas, escolhe um horario e segue para a reserva online quando fizer sentido.",
  },
  {
    question: "A plataforma e segura?",
    answer:
      "A experiencia publica mostra apenas informacoes necessarias para a escolha. Dados sensiveis e dados de sessao devem seguir as regras de RLS e privacidade do projeto.",
  },
  {
    question: "Como escolho a terapeuta ideal para mim?",
    answer:
      "Voce pode iniciar pela jornada guiada, explorar terapias ou comparar perfis. A escolha deve acontecer com calma, sem promessa de resultado.",
  },
  {
    question: "A sessao e online?",
    answer:
      "O fluxo publico apresenta sessoes online. O link da sessao so deve ser gerado apos pagamento confirmado pelas regras transacionais do projeto.",
  },
  {
    question: "Posso reagendar se necessario?",
    answer:
      "As regras de reagendamento devem aparecer no fluxo de reserva e na area logada, conforme politicas do produto.",
  },
  {
    question: "O TES substitui acompanhamento medico?",
    answer:
      "Nao. O conteudo do TES e informativo e nao substitui acompanhamento medico, psicologico, diagnostico ou tratamento profissional.",
  },
];
