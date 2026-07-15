import { routes } from "@/lib/routes";

import type { AvailabilityDay, TherapistProfileData } from "./types";

const reikiServiceId = "d1000000-0000-4000-8000-000000000001";
const aromatherapyServiceId = "d1000000-0000-4000-8000-000000000006";

const reikiAvailability: AvailabilityDay[] = [
  {
    dateLabel: "Hoje",
    dayLabel: "Hoje",
    slots: [
      {
        dateLabel: "Hoje",
        dayLabel: "Hoje",
        endsAt: new Date(Date.now() + 50 * 60 * 1000).toISOString(),
        serviceId: reikiServiceId,
        startsAt: new Date().toISOString(),
        timeLabel: "09:00",
      },
      {
        dateLabel: "Hoje",
        dayLabel: "Hoje",
        endsAt: new Date(Date.now() + 110 * 60 * 1000).toISOString(),
        serviceId: reikiServiceId,
        startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        timeLabel: "10:30",
      },
    ],
  },
  {
    dateLabel: "Amanhã",
    dayLabel: "Amanhã",
    slots: [
      {
        dateLabel: "Amanhã",
        dayLabel: "Amanhã",
        endsAt: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
        serviceId: reikiServiceId,
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        timeLabel: "15:30",
      },
    ],
  },
];

const aromatherapyAvailability: AvailabilityDay[] = [
  {
    dateLabel: "Hoje",
    dayLabel: "Hoje",
    slots: [
      {
        dateLabel: "Hoje",
        dayLabel: "Hoje",
        endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        serviceId: aromatherapyServiceId,
        startsAt: new Date().toISOString(),
        timeLabel: "11:00",
      },
    ],
  },
  {
    dateLabel: "sex",
    dayLabel: "sex",
    slots: [
      {
        dateLabel: "sex",
        dayLabel: "sex",
        endsAt: new Date(Date.now() + 74 * 60 * 60 * 1000).toISOString(),
        serviceId: aromatherapyServiceId,
        startsAt: new Date(Date.now() + 73 * 60 * 60 * 1000).toISOString(),
        timeLabel: "14:00",
      },
    ],
  },
];

export const fallbackTherapistProfile: TherapistProfileData = {
  availability: reikiAvailability,
  profile: {
    acceptsOnlineSessions: true,
    badges: ["Perfil verificado", "Terapeuta Plus"],
    bio:
      "Sou terapeuta integrativa há mais de 8 anos. Minha missão é oferecer acolhimento, escuta e orientação para você se conectar com sua essência, leveza e verdade.",
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
        description: "Harmonização dos centros energéticos, equilíbrio e bem-estar profundo.",
        durationMinutes: 50,
        id: "d1000000-0000-4000-8000-000000000001",
        priceCents: 17000,
        priceLabel: "R$ 170",
        title: "Reiki",
        therapyName: "Terapia Integrativa",
        therapySlug: "terapia-integrativa",
      },
      {
        availability: aromatherapyAvailability,
        bookingUrl: `${routes.public.reservation}?therapist=ana-oliveira&service=d1000000-0000-4000-8000-000000000006`,
        currency: "BRL",
        description: "Equilíbrio emocional e energético através dos óleos essenciais.",
        durationMinutes: 60,
        id: "d1000000-0000-4000-8000-000000000006",
        priceCents: 24000,
        priceLabel: "R$ 240",
        title: "Aromaterapia",
        therapyName: "Terapia Integrativa",
        therapySlug: "terapia-integrativa",
      },
    ],
    slug: "ana-oliveira",
    tags: ["Reiki", "Tarô", "Oráculos", "Aromaterapia"],
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
      body:
        "As sessões online me deram o acolhimento que eu precisava, no meu tempo e no meu espaço.",
      createdLabel: "Há dois dias",
      id: "90000000-0000-4000-8000-000000000001",
      patientContext: "Paciente há 5 meses",
      rating: 5,
    },
    {
      authorLabel: "Paciente TES",
      body: "Senti clareza e cuidado durante toda a conversa.",
      createdLabel: "Há uma semana",
      id: "90000000-0000-4000-8000-000000000006",
      patientContext: "Sessão concluída pela plataforma",
      rating: 5,
    },
  ],
  source: "fallback",
};
