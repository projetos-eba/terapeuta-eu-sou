import { cleanup, render, screen, within } from "@testing-library/react";
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
});
