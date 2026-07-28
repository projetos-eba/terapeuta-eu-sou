import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TherapistProfileEditorData } from "../therapist-profile-editor.types";
import { TherapistProfileEditorPage } from "./therapist-profile-editor-page";

const editor: TherapistProfileEditorData = {
  capabilities: {
    canPublishAdditionalServices: true,
    canPublishProfile: true,
    canUploadVideo: true,
    canUseAdvancedSections: false,
    canUseFeaturedMedia: true,
  },
  completeness: {
    items: [{ complete: true, key: "photo", label: "Foto de perfil" }],
    percent: 80,
    score: 4,
    total: 5,
  },
  derived: {
    accountStatus: "approved",
    activeServiceCount: 2,
    availabilityRuleCount: 3,
    averageRating: 4.9,
    canReceiveBookings: true,
    completedSessions: 12,
    hasAvailability: true,
    plan: "premium_plus",
    publicStatus: "published",
    reviewCount: 8,
    startingPriceCents: 17000,
    verificationStatus: "approved",
  },
  draft: null,
  propagationNotice:
    "As alterações publicadas podem levar até 2 a 3 horas para aparecer em todas as superfícies públicas.",
  publicProfileHref: "/terapeutas/ana-oliveira",
  published: {
    baseProfileVersion: null,
    contentVersionId: "published-version",
    fields: {
      bio: "Atendimento online com escuta responsável.",
      city: "",
      essenceBody: "Presença e cuidado.",
      experienceYears: 8,
      guideItems: [{ icon: "sparkles", label: "Escuta acolhedora" }],
      headline: "",
      invitationBody: "",
      photoUrl: "/therapists/ana-oliveira.png",
      publicName: "Ana Oliveira",
      reflections: [],
      shortIntro: "Acolhimento online.",
      state: "",
      videoProvider: "external",
      videoThumbnailUrl: "",
      videoTitle: "",
      videoUrl: "",
    },
    publishedAt: "2026-07-27T12:00:00.000Z",
    status: "published",
    updatedAt: "2026-07-27T12:00:00.000Z",
  },
  therapistProfileId: "c1000000-0000-4000-8000-000000000001",
  updatedAt: "2026-07-28T12:00:00.000Z",
  version: 4,
};

describe("TherapistProfileEditorPage", () => {
  it("renders the profile editor with real read-only derived data", () => {
    render(<TherapistProfileEditorPage editor={editor} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Perfil público" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do perfil")).toHaveValue("Ana Oliveira");
    expect(screen.getByText("Dados derivados")).toBeInTheDocument();
    expect(screen.getByText("R$ 170")).toBeInTheDocument();
  });

  it("communicates publication propagation and disables publish without a draft", () => {
    render(<TherapistProfileEditorPage editor={editor} />);

    expect(screen.getAllByText(/2 a 3 horas/).length).toBeGreaterThan(0);
    screen
      .getAllByRole("button", { name: /Publicar alterações/ })
      .forEach((button) => expect(button).toBeDisabled());
  });
});
