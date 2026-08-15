import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { TherapistProfileEditorData } from "../therapist-profile-editor.types";
import { TherapistProfileOverviewPage } from "./therapist-profile-overview-page";

function makeEditor(
  overrides: Partial<TherapistProfileEditorData> = {},
): TherapistProfileEditorData {
  const editor: TherapistProfileEditorData = {
    capabilities: {
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
      "As alterações publicadas podem levar até 2 a 3 horas para aparecer em todas as superfícies públicas.",
    publicProfileHref: "/terapeutas/ana-oliveira",
    published: {
      baseProfileVersion: null,
      contentVersionId: "published-version",
      fields: {
        bio: "Atendimento online com escuta responsável.",
        city: "",
        essenceBody: "Presença e cuidado publicado.",
        experienceYears: 8,
        guideItems: [{ icon: "sparkles", label: "Escuta acolhedora" }],
        headline: "",
        invitationBody: "",
        photoUrl: "/therapists/ana-oliveira.png",
        publicName: "Ana Oliveira",
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

describe("TherapistProfileOverviewPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the profile preview as the first therapist profile surface", () => {
    render(<TherapistProfileOverviewPage editor={makeEditor()} />);

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
      screen.getByRole("heading", { name: "Preview do perfil" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ana Oliveira")).toBeInTheDocument();
    expect(screen.getByText("Atendimento online")).toBeInTheDocument();
    expect(screen.getByText("Status do perfil")).toBeInTheDocument();
    expect(screen.getByText("Checklist de confiança")).toBeInTheDocument();
  });

  it("shows only the published profile in the overview when a draft exists", () => {
    render(
      <TherapistProfileOverviewPage
        editor={makeEditor({
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
        })}
      />,
    );

    const preview = screen
      .getByRole("heading", { name: "Preview do perfil" })
      .closest("section");

    expect(screen.getByText("Existe um rascunho salvo.")).toBeInTheDocument();
    expect(preview).not.toBeNull();
    expect(within(preview!).getByText("Ana Oliveira")).toBeInTheDocument();
    expect(
      within(preview!).queryByText("Ana Rascunho Privado"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/documento/i)).not.toBeInTheDocument();
  });

  it("switches to the registration flow while documents are still missing", () => {
    render(
      <TherapistProfileOverviewPage
        editor={makeEditor({
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
        })}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Cadastro em análise" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Seu progresso de cadastro")).toBeInTheDocument();
    expect(screen.getByText("Documentos enviados")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Preview do perfil" }),
    ).not.toBeInTheDocument();
  });
});
