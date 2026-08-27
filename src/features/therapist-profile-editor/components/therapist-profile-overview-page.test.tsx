import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { TherapistProfileData } from "@/features/therapist-profile/types";

import type { TherapistProfileEditorData } from "../therapist-profile-editor.types";
import {
  TherapistProfileOverviewPage,
  type TherapistProfilePublishedPreview,
} from "./therapist-profile-overview-page";

function makeEditor(
  overrides: Partial<TherapistProfileEditorData> = {},
): TherapistProfileEditorData {
  const editor: TherapistProfileEditorData = {
    capabilities: {
      canCustomizePublicSlug: true,
      canPublishAdditionalServices: true,
      canPublishProfile: true,
      canUploadVideo: true,
      canUseAdvancedSections: false,
      canUseFeaturedMedia: true,
    },
    completeness: {
      items: [
        { complete: true, key: "photo", label: "Foto de perfil" },
        { complete: true, key: "bio", label: "Mini bio" },
      ],
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
    privateDocuments: [
      {
        createdAt: "2026-07-28T11:00:00.000Z",
        fileName: "rg.pdf",
        fileSizeBytes: 1200,
        id: "doc-identity",
        kind: "identity_document",
        mimeType: "application/pdf",
        status: "uploaded",
        updatedAt: "2026-07-28T11:00:00.000Z",
        validationState: "not_scanned",
      },
      {
        createdAt: "2026-07-28T11:05:00.000Z",
        fileName: "endereco.pdf",
        fileSizeBytes: 1400,
        id: "doc-address",
        kind: "address_proof",
        mimeType: "application/pdf",
        status: "uploaded",
        updatedAt: "2026-07-28T11:05:00.000Z",
        validationState: "not_scanned",
      },
    ],
    propagationNotice:
      "Depois da aprovação, as alterações podem levar até 2 a 3 horas para aparecer em todas as superfícies públicas.",
    publicProfileHref: "/terapeutas/ana-oliveira",
    publicProfileSlug: "ana-oliveira",
    publicProfileTheme: "serene",
    published: {
      baseProfileVersion: null,
      contentVersionId: "published-version",
      fields: {
        bioIllustrationId: null,
        bio: "Atendimento online com escuta responsável.",
        city: "",
        essenceBody: "Presença e cuidado publicado.",
        experienceYears: 8,
        guideItems: [{ icon: "sparkles", label: "Escuta acolhedora" }],
        headline: "",
        invitationBody: "",
        photoUrl: "/therapists/ana-oliveira.png",
        publicName: "Ana Oliveira",
        publicProfileTheme: "serene",
        reflections: [],
        shortIntro: "Acolhimento online publicado.",
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
    verificationSummary: {
      id: "verification-1",
      rejectionReason: null,
      reviewedAt: "2026-07-29T09:00:00.000Z",
      status: "approved",
      submittedAt: "2026-07-28T11:10:00.000Z",
    },
    version: 4,
  };

  return { ...editor, ...overrides };
}

function makePublishedPreview(
  overrides: Partial<TherapistProfileData> = {},
): TherapistProfilePublishedPreview {
  return {
    data: {
      availability: [],
      profile: {
        acceptsOnlineSessions: true,
        badges: [],
        bio: "Esta é a versão pública do perfil.",
        cityState: "São Paulo, SP",
        content: {
          bioIllustrationId: null,
          essenceBody: "Presença e cuidado publicados.",
          experienceYears: 8,
          guideItems: [{ icon: "sparkles", label: "Escuta acolhedora" }],
          invitationBody: "Conheça a proposta com calma.",
          publicProfileTheme: "serene",
          reflections: [],
          shortIntro: "Acolhimento publicado.",
        },
        headline: "Acolhimento publicado.",
        heroImage: "/therapists/ana-publica.png",
        id: "public-profile-1",
        isAcceptingBookings: false,
        isVerified: true,
        name: "Ana publicada",
        plan: "premium_plus",
        profileUrl: "/terapeutas/ana-oliveira",
        publicProfileTheme: "serene",
        rating: { average: null, count: 0, sessionsCompleted: 0 },
        services: [],
        slug: "ana-oliveira",
        tags: [],
        video: null,
      },
      reviews: [],
      source: "live",
      ...overrides,
    },
    status: "success",
  };
}

function renderOverview(
  editor = makeEditor(),
  publishedPreview = makePublishedPreview(),
) {
  return render(
    <TherapistProfileOverviewPage
      editor={editor}
      publishedPreview={publishedPreview}
    />,
  );
}

describe("TherapistProfileOverviewPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the profile preview as the first therapist profile surface", () => {
    renderOverview(
      makeEditor({
        published: {
          ...makeEditor().published,
          fields: {
            ...makeEditor().published.fields,
            publicName: "Nome apenas do editor",
          },
        },
      }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Perfil público" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver perfil público" }),
    ).toHaveAttribute("href", "/terapeutas/ana-oliveira");
    expect(screen.getByRole("link", { name: "Editar perfil" })).toHaveAttribute(
      "href",
      "/terapeuta/perfil/editar",
    );
    expect(
      screen.getByRole("heading", { name: "Prévia do perfil publicado" }),
    ).toBeInTheDocument();
    const preview = screen.getByTestId("public-profile-desktop-preview");

    expect(preview).toBeInTheDocument();
    expect(preview.querySelector("[inert]")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByText("Ana publicada")).toBeInTheDocument();
    expect(screen.queryByText("Nome apenas do editor")).not.toBeInTheDocument();
    expect(screen.getByText("Status do perfil")).toBeInTheDocument();
    expect(screen.getByText("O que falta no seu perfil")).toBeInTheDocument();
  });

  it("shows only the published profile in the overview when a draft exists", () => {
    renderOverview(
      makeEditor({
        draft: {
          baseProfileVersion: 4,
          contentVersionId: "draft-version",
          fields: {
            ...makeEditor().published.fields,
            publicName: "Ana Rascunho Privado",
            shortIntro: "Texto privado ainda não publicado.",
          },
          publishedAt: null,
          status: "draft",
          updatedAt: "2026-07-28T13:00:00.000Z",
        },
      }),
    );

    const preview = screen
      .getByRole("heading", { name: "Prévia do perfil publicado" })
      .closest("section");

    expect(screen.getByText("Existe um rascunho salvo.")).toBeInTheDocument();
    expect(preview).not.toBeNull();
    expect(within(preview!).getByText("Ana publicada")).toBeInTheDocument();
    expect(
      within(preview!).queryByText("Ana Rascunho Privado"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/documento/i)).not.toBeInTheDocument();
  });

  it("switches to the registration flow while documents are still missing", () => {
    renderOverview(
      makeEditor({
        derived: {
          ...makeEditor().derived,
          verificationStatus: "submitted",
        },
        privateDocuments: [
          {
            createdAt: "2026-07-28T11:00:00.000Z",
            fileName: "rg.pdf",
            fileSizeBytes: 1200,
            id: "doc-identity",
            kind: "identity_document",
            mimeType: "application/pdf",
            status: "uploaded",
            updatedAt: "2026-07-28T11:00:00.000Z",
            validationState: "not_scanned",
          },
        ],
        verificationSummary: {
          id: "verification-2",
          rejectionReason: null,
          reviewedAt: null,
          status: "submitted",
          submittedAt: "2026-07-28T11:10:00.000Z",
        },
      }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Cadastro em análise" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Seu progresso de cadastro")).toBeInTheDocument();
    expect(screen.getAllByText("Dados e documentos").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("heading", { name: "Prévia do perfil publicado" }),
    ).not.toBeInTheDocument();
  });

  it("shows the administrative correction reason in the registration flow", () => {
    renderOverview(
      makeEditor({
        derived: {
          ...makeEditor().derived,
          publicStatus: "unpublished",
          verificationStatus: "changes_requested",
        },
        verificationSummary: {
          changesRequested: "Atualize sua apresentação e informe sua cidade.",
          id: "verification-3",
          rejectionReason: null,
          reviewedAt: "2026-08-25T09:00:00.000Z",
          status: "changes_requested",
          submittedAt: "2026-08-24T09:00:00.000Z",
        },
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "Correções solicitadas pela equipe TES",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Atualize sua apresentação e informe sua cidade."),
    ).toBeInTheDocument();
  });

  it("keeps an honest state when the public profile cannot be read", () => {
    renderOverview(makeEditor(), { status: "unavailable" });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar a prévia agora",
    );
    expect(screen.queryByTestId("public-profile-desktop-preview")).toBeNull();
  });

  it("does not offer a public profile link before publication", () => {
    renderOverview(
      makeEditor({
        derived: {
          ...makeEditor().derived,
          publicStatus: "unpublished",
        },
      }),
      { status: "not_published" },
    );

    expect(
      screen.getByText("Seu perfil ainda não está publicado"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ver perfil público" }),
    ).toBeNull();
  });

  it("explains when a published status no longer resolves to a public profile", () => {
    renderOverview(makeEditor(), { status: "not_found" });

    expect(
      screen.getByText("Não foi possível encontrar seu perfil público"),
    ).toBeInTheDocument();
  });
});
