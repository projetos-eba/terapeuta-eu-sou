import { routes } from "@/lib/routes";

import type { AvailabilityDay, TherapistProfileData } from "./types";

const reikiServiceId = "d1000000-0000-4000-8000-000000000001";
const aromatherapyServiceId = "d1000000-0000-4000-8000-000000000006";
const rafaelServiceId = "d1000000-0000-4000-8000-000000000002";

function getFallbackDate(daysAhead: number, timeLabel: string) {
  const [hours = "0", minutes = "0"] = timeLabel.split(":");
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date;
}

function formatFallbackDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatFallbackDateLabel(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatFallbackDayLabel(daysAhead: number, date: Date) {
  if (daysAhead === 0) return "Hoje";
  if (daysAhead === 1) return "Amanhã";

  return date
    .toLocaleDateString("pt-BR", { weekday: "short" })
    .replace(".", "");
}

function createFallbackAvailabilityDay({
  daysAhead,
  durationMinutes,
  serviceId,
  times,
}: {
  daysAhead: number;
  durationMinutes: number;
  serviceId: string;
  times: string[];
}): AvailabilityDay {
  const dayDate = getFallbackDate(daysAhead, times[0] ?? "09:00");
  const date = formatFallbackDateKey(dayDate);
  const dateLabel = formatFallbackDateLabel(dayDate);
  const dayLabel = formatFallbackDayLabel(daysAhead, dayDate);

  return {
    date,
    dateLabel,
    dayLabel,
    slots: times.map((timeLabel) => {
      const startsAt = getFallbackDate(daysAhead, timeLabel);
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

      return {
        dateLabel,
        dayLabel,
        endsAt: endsAt.toISOString(),
        serviceId,
        startsAt: startsAt.toISOString(),
        timeLabel,
      };
    }),
  };
}

const reikiAvailability: AvailabilityDay[] = [
  createFallbackAvailabilityDay({
    daysAhead: 0,
    durationMinutes: 50,
    serviceId: reikiServiceId,
    times: ["09:00", "10:30"],
  }),
  createFallbackAvailabilityDay({
    daysAhead: 1,
    durationMinutes: 50,
    serviceId: reikiServiceId,
    times: ["15:30"],
  }),
  createFallbackAvailabilityDay({
    daysAhead: 4,
    durationMinutes: 50,
    serviceId: reikiServiceId,
    times: ["09:40", "10:10", "10:40", "11:10"],
  }),
];

const aromatherapyAvailability: AvailabilityDay[] = [
  createFallbackAvailabilityDay({
    daysAhead: 0,
    durationMinutes: 60,
    serviceId: aromatherapyServiceId,
    times: ["11:00"],
  }),
  createFallbackAvailabilityDay({
    daysAhead: 3,
    durationMinutes: 60,
    serviceId: aromatherapyServiceId,
    times: ["14:00"],
  }),
];

const rafaelAvailability: AvailabilityDay[] = [
  createFallbackAvailabilityDay({
    daysAhead: 1,
    durationMinutes: 50,
    serviceId: rafaelServiceId,
    times: ["09:30"],
  }),
  createFallbackAvailabilityDay({
    daysAhead: 6,
    durationMinutes: 50,
    serviceId: rafaelServiceId,
    times: ["16:00", "16:30"],
  }),
];

export const fallbackTherapistProfile: TherapistProfileData = {
  availability: reikiAvailability,
  profile: {
    acceptsOnlineSessions: true,
    badges: ["Perfil verificado", "Terapeuta Plus"],
    bio: "Sou terapeuta integrativa há mais de 8 anos. Minha missão é oferecer acolhimento, escuta e orientação para você se conectar com sua essência, leveza e verdade.",
    cityState: "São Paulo, SP",
    content: {
      essenceBody:
        "Sou terapeuta integrativa há mais de 8 anos. Minha missão é oferecer acolhimento, escuta e orientação para você se conectar com sua essência, leveza e verdade.",
      experienceYears: 8,
      guideItems: [
        { icon: "leaf", label: "Clareza emocional" },
        { icon: "sparkles", label: "Equilíbrio energético" },
        { icon: "star", label: "Reconexão interior" },
        { icon: "clock", label: "Propósito e direção" },
        { icon: "heart", label: "Relacionamentos conscientes" },
        { icon: "compass", label: "Transições de vida" },
      ],
      invitationBody:
        "Assista ao vídeo e me conheça um pouco mais. Falo sobre minha jornada e como posso te acompanhar no seu momento atual.",
      reflections: [
        {
          href: routes.public.therapistProfile("ana-oliveira"),
          imageUrl: "/home/tablet-video-session.png",
          minutesToRead: 3,
          title: "Sobre a vida curta",
        },
      ],
      shortIntro:
        "Bem-vinda, alma bonita. Intuição que acolhe, energia que cuida e orientação que ilumina seu caminho de volta para você.",
    },
    headline:
      "Bem-vinda, alma bonita. Intuição que acolhe, energia que cuida e orientação que ilumina seu caminho de volta para você.",
    heroImage: "/therapists/ana-oliveira.png",
    id: "c1000000-0000-4000-8000-000000000001",
    isAcceptingBookings: true,
    isVerified: true,
    name: "Ana Oliveira",
    plan: "premium_plus",
    profileUrl: routes.public.therapistProfile("ana-oliveira"),
    rating: {
      average: 4.9,
      count: 3,
      sessionsCompleted: 4,
    },
    services: [
      {
        availability: reikiAvailability,
        bookingUrl: `${routes.public.reservation}?therapist=ana-oliveira&service=d1000000-0000-4000-8000-000000000001`,
        currency: "BRL",
        description:
          "Sessão complementar de Reiki conduzida por vídeo, com foco em presença e cuidado energético responsável.",
        durationMinutes: 50,
        id: "d1000000-0000-4000-8000-000000000001",
        priceCents: 17000,
        priceLabel: "R$ 170",
        title: "Reiki online",
        therapyName: "Reiki",
        therapySlug: "reiki",
      },
      {
        availability: aromatherapyAvailability,
        bookingUrl: `${routes.public.reservation}?therapist=ana-oliveira&service=d1000000-0000-4000-8000-000000000006`,
        currency: "BRL",
        description:
          "Leitura simbólica para refletir sobre escolhas, padrões e caminhos possíveis.",
        durationMinutes: 60,
        id: "d1000000-0000-4000-8000-000000000006",
        priceCents: 24000,
        priceLabel: "R$ 240",
        title: "Tarô e autoconhecimento",
        therapyName: "Tarô",
        therapySlug: "taro",
      },
    ],
    slug: "ana-oliveira",
    tags: ["Reiki", "Tarô", "Oráculos"],
    video: {
      provider: "external",
      thumbnailUrl: "/home/tablet-video-session.png",
      title: "Um convite para você",
      url: "https://example.test/videos/ana-oliveira",
    },
  },
  reviews: [
    {
      authorLabel: "Paciente TES",
      body: "As sessões online me deram o acolhimento que eu precisava, no meu tempo e no meu espaço.",
      createdLabel: "Há dois dias",
      id: "90000000-0000-4000-8000-000000000001",
      patientContext: "Paciente há 5 meses",
      rating: 5,
      reply: null,
    },
    {
      authorLabel: "Paciente TES",
      body: "Senti clareza e cuidado durante toda a conversa.",
      createdLabel: "Há uma semana",
      id: "90000000-0000-4000-8000-000000000006",
      patientContext: "Sessão concluída pela plataforma",
      rating: 5,
      reply: null,
    },
  ],
  source: "demo",
};

export const fallbackTherapistProfilesBySlug: Record<
  string,
  TherapistProfileData
> = {
  [fallbackTherapistProfile.profile.slug]: fallbackTherapistProfile,
  "rafael-santos": {
    availability: rafaelAvailability,
    profile: {
      acceptsOnlineSessions: true,
      badges: ["Perfil verificado"],
      bio: "Rafael acompanha pessoas em fases de mudança com escuta integrativa e combinados claros de sessão.",
      cityState: "Rio de Janeiro, RJ",
      content: {
        essenceBody:
          "Rafael acompanha pessoas em fases de mudança com escuta integrativa e combinados claros de sessão.",
        experienceYears: 6,
        guideItems: [
          { icon: "compass", label: "Mudanças de vida" },
          { icon: "sparkles", label: "Propósito" },
          { icon: "leaf", label: "Equilíbrio emocional" },
        ],
        invitationBody:
          "Conheça a abordagem de Rafael e veja como uma sessão online pode apoiar suas reflexões com calma e responsabilidade.",
        reflections: [],
        shortIntro:
          "Sessões para mudanças de vida, propósito e reorganização de caminhos.",
      },
      headline:
        "Sessões para mudanças de vida, propósito e reorganização de caminhos.",
      heroImage: "/therapists/rafael-santos-avatar.png",
      id: "c1000000-0000-4000-8000-000000000002",
      isAcceptingBookings: true,
      isVerified: true,
      name: "Rafael Santos",
      plan: "premium",
      profileUrl: routes.public.therapistProfile("rafael-santos"),
      rating: {
        average: 4.8,
        count: 74,
        sessionsCompleted: 1,
      },
      services: [
        {
          availability: rafaelAvailability,
          bookingUrl: `${routes.public.reservation}?therapist=rafael-santos&service=d1000000-0000-4000-8000-000000000002`,
          currency: "BRL",
          description:
            "Apoio para quem está vivendo mudanças importantes e deseja encontrar novos caminhos.",
          durationMinutes: 50,
          id: "d1000000-0000-4000-8000-000000000002",
          priceCents: 12000,
          priceLabel: "R$ 120",
          title: "Leitura simbólica de Tarô",
          therapyName: "Tarô",
          therapySlug: "taro",
        },
      ],
      slug: "rafael-santos",
      tags: ["Mudanças de vida", "Propósito", "Equilíbrio emocional"],
      video: {
        provider: "external",
        thumbnailUrl: "/home/tablet-video-session.png",
        title: "Um convite para você",
        url: "https://example.test/videos/rafael-santos",
      },
    },
    reviews: [
      {
        authorLabel: "Paciente TES",
        body: "Ajudou a organizar um momento muito difícil.",
        createdLabel: "Experiência compartilhada",
        id: "90000000-0000-4000-8000-000000000002",
        patientContext: "Sessão concluída pela plataforma",
        rating: 5,
        reply: null,
      },
    ],
    source: "demo",
  },
};

export function getFallbackTherapistProfile(slug: string) {
  return fallbackTherapistProfilesBySlug[slug] ?? null;
}
