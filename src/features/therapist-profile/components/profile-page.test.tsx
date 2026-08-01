import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TherapistProfilePage } from "./profile-page";
import type { PublicTherapistProfile } from "../types";

const baseProfile: PublicTherapistProfile = {
  acceptsOnlineSessions: true,
  badges: ["Perfil verificado"],
  bio: "Acolhimento responsável.",
  cityState: "São Paulo, SP",
  content: {
    essenceBody: "Atendo com presença, escuta e combinados claros.",
    experienceYears: 8,
    guideItems: [{ icon: "heart", label: "Clareza emocional" }],
    invitationBody:
      "Conheça minha abordagem com calma, sem promessa de resultado.",
    reflections: [],
    shortIntro: "Escuta responsável para seu momento.",
  },
  heroImage: "/therapists/ana-oliveira.png",
  headline: "Escuta responsável para seu momento.",
  id: "profile-1",
  isAcceptingBookings: false,
  isVerified: true,
  name: "Ana Oliveira",
  plan: "premium_plus",
  profileUrl: "/terapeutas/ana-oliveira",
  rating: {
    average: null,
    count: 0,
    sessionsCompleted: 0,
  },
  services: [],
  slug: "ana-oliveira",
  tags: ["Reiki"],
  video: null,
};

describe("TherapistProfilePage video block", () => {
  afterEach(() => cleanup());

  it("does not render a clickable video link when the profile has no valid video", () => {
    render(<TherapistProfilePage profile={baseProfile} reviews={[]} />);

    const invitation = screen
      .getByRole("heading", { name: "Um convite para você" })
      .closest("article");

    expect(invitation).not.toBeNull();
    expect(
      within(invitation as HTMLElement).getByText(
        "Vídeo de apresentação indisponível no momento.",
      ),
    ).toBeInTheDocument();
    expect(within(invitation as HTMLElement).queryByRole("link")).toBeNull();
  });

  it("keeps favorite and share icon buttons accessible", () => {
    render(<TherapistProfilePage profile={baseProfile} reviews={[]} />);

    expect(
      screen.getByRole("button", {
        name: "Adicionar Ana Oliveira aos favoritos",
      }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "Compartilhar perfil" }),
    ).toHaveClass("size-[52px]");
  });

  it("shows public services by canonical therapy name without operational labels", () => {
    render(
      <TherapistProfilePage
        profile={{
          ...baseProfile,
          isAcceptingBookings: true,
          services: [
            {
              availability: [],
              bookingUrl: "/reserva?service=service-1",
              currency: "BRL",
              description: "Sessão online com cuidado responsável.",
              durationMinutes: 50,
              id: "service-1",
              priceCents: 17000,
              priceLabel: "R$ 170",
              title: "Reiki online",
              therapyId: "therapy-1",
              therapyName: "Reiki",
              therapySlug: "reiki",
            },
          ],
        }}
        reviews={[]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Vivências e terapias" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Serviços online")).not.toBeInTheDocument();
    expect(screen.getAllByText("Reiki").length).toBeGreaterThan(0);
    expect(screen.queryByText("Reiki online")).not.toBeInTheDocument();
  });

  it("shows one therapist reply sentence before expanding the full answer", () => {
    render(
      <TherapistProfilePage
        profile={{
          ...baseProfile,
          rating: { average: 5, count: 1, sessionsCompleted: 1 },
        }}
        reviews={[
          {
            authorLabel: "Paciente TES",
            body: "Conversa atenta e respeitosa com o meu momento.",
            createdLabel: "Há uma semana",
            id: "review-1",
            patientContext: "Sessão concluída pela plataforma",
            rating: 5,
            reply: {
              body: "Obrigada por compartilhar sua experiência com tanto cuidado. Seguimos com presença e combinados claros para a continuidade.",
              publishedAt: null,
            },
          },
        ]}
      />,
    );

    expect(
      screen.getByText(
        "Obrigada por compartilhar sua experiência com tanto cuidado.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Seguimos com presença e combinados claros/),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ler resposta completa" }));

    expect(
      screen.getByText(/Seguimos com presença e combinados claros/),
    ).toBeInTheDocument();
  });
});
