import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TherapistProfileEditorData } from "../therapist-profile-editor.types";
import { TherapistProfileEditorPage } from "./therapist-profile-editor-page";

const commandMocks = vi.hoisted(() => ({
  createStableRequestId: vi.fn(() => "11111111-1111-4111-8111-111111111111"),
  sendTherapistProfileCommand: vi.fn(),
  uploadTherapistProfileMedia: vi.fn(),
}));

vi.mock("../therapist-profile-editor.commands", () => commandMocks);

type EditorOverrides = Omit<
  Partial<TherapistProfileEditorData>,
  "capabilities" | "derived"
> & {
  capabilities?: Partial<TherapistProfileEditorData["capabilities"]>;
  derived?: Partial<TherapistProfileEditorData["derived"]>;
};

function makeEditor(
  overrides: EditorOverrides = {},
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

  return {
    ...editor,
    ...overrides,
    capabilities: {
      ...editor.capabilities,
      ...overrides.capabilities,
    },
    derived: {
      ...editor.derived,
      ...overrides.derived,
    },
  };
}

describe("TherapistProfileEditorPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    commandMocks.createStableRequestId.mockReturnValue(
      "11111111-1111-4111-8111-111111111111",
    );
    commandMocks.sendTherapistProfileCommand.mockReset();
    commandMocks.uploadTherapistProfileMedia.mockReset();
  });

  it("renders the profile editor with real read-only derived data", () => {
    const editor = makeEditor();

    render(<TherapistProfileEditorPage editor={editor} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Editar perfil" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do perfil")).toHaveValue("Ana Oliveira");
    expect(
      screen.getByRole("link", { name: "Visualizar perfil" }),
    ).toHaveAttribute("href", "/terapeuta/perfil");
    expect(screen.getByText("Progresso do perfil")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Preview do perfil" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Informações gerenciadas em outras páginas"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "As informações acima são exibidas no seu perfil público. Preços, horários, avaliações, documentos e dados administrativos continuam em suas fontes próprias e não são editados aqui.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Dados derivados")).not.toBeInTheDocument();
  });

  it("keeps private draft fields in the editor without rendering the public preview", () => {
    render(
      <TherapistProfileEditorPage
        editor={makeEditor({
          draft: {
            baseProfileVersion: 4,
            contentVersionId: "draft-version",
            fields: {
              ...makeEditor().published.fields,
              publicName: "Ana Prévia",
              shortIntro: "Texto que ainda não foi publicado.",
            },
            publishedAt: null,
            status: "draft",
            updatedAt: "2026-07-28T13:00:00.000Z",
          },
        })}
      />,
    );

    expect(screen.getByLabelText("Nome do perfil")).toHaveValue("Ana Prévia");
    expect(
      screen.queryByRole("heading", { name: "Prévia pública" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/documento privado/i)).not.toBeInTheDocument();
  });

  it("communicates publication propagation and disables publish without a draft", () => {
    const editor = makeEditor();

    render(<TherapistProfileEditorPage editor={editor} />);

    expect(screen.getAllByText(/2 a 3 horas/).length).toBeGreaterThan(0);
    screen
      .getAllByRole("button", { name: /Publicar alterações/ })
      .forEach((button) => expect(button).toBeDisabled());
  });

  it("saves local edits as a private draft without publishing them", async () => {
    const draftEditor = makeEditor({
      draft: {
        baseProfileVersion: 4,
        contentVersionId: "draft-version",
        fields: {
          ...makeEditor().published.fields,
          publicName: "Ana Rascunho",
          shortIntro: "Texto salvo apenas como rascunho.",
        },
        publishedAt: null,
        status: "draft",
        updatedAt: "2026-07-28T13:00:00.000Z",
      },
      version: 5,
    });
    commandMocks.sendTherapistProfileCommand.mockResolvedValueOnce({
      data: { editor: draftEditor, idempotentReplay: false },
      status: "success",
    });

    render(<TherapistProfileEditorPage editor={makeEditor()} />);

    fireEvent.change(screen.getByLabelText("Nome do perfil"), {
      target: { value: "Ana Rascunho" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(commandMocks.sendTherapistProfileCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "save_draft",
          expectedVersion: 4,
          payload: expect.objectContaining({
            publicName: "Ana Rascunho",
          }),
          requestId: "11111111-1111-4111-8111-111111111111",
        }),
      );
    });
    expect(screen.getByText("Rascunho salvo.")).toBeInTheDocument();
    expect(
      screen.getByText("Existe um rascunho salvo aguardando publicação."),
    ).toBeInTheDocument();
  });

  it("publishes a saved draft through an explicit confirmation dialog", async () => {
    const editorWithDraft = makeEditor({
      draft: {
        baseProfileVersion: 4,
        contentVersionId: "draft-version",
        fields: {
          ...makeEditor().published.fields,
          publicName: "Ana Publicada M2",
          shortIntro: "Conteúdo pronto para publicação.",
        },
        publishedAt: null,
        status: "draft",
        updatedAt: "2026-07-28T13:00:00.000Z",
      },
    });
    const publishedEditor = makeEditor({
      draft: null,
      published: {
        ...makeEditor().published,
        fields: editorWithDraft.draft!.fields,
        updatedAt: "2026-07-28T14:00:00.000Z",
      },
      version: 5,
    });
    commandMocks.sendTherapistProfileCommand.mockResolvedValueOnce({
      data: { editor: publishedEditor, idempotentReplay: false },
      status: "success",
    });

    render(<TherapistProfileEditorPage editor={editorWithDraft} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Publicar alterações" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Publicar alterações?",
    });
    expect(dialog).toHaveTextContent(/2 a 3 horas/);
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Publicar alterações" }),
    );

    await waitFor(() => {
      expect(commandMocks.sendTherapistProfileCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "publish",
          expectedVersion: 4,
        }),
      );
    });
    expect(screen.getAllByText(/Alterações publicadas/).length).toBeGreaterThan(
      0,
    );
    expect(
      screen.queryByRole("dialog", { name: "Publicar alterações?" }),
    ).not.toBeInTheDocument();
  });

  it("shows a readable version conflict and restores controls on mutation error", async () => {
    commandMocks.sendTherapistProfileCommand.mockResolvedValueOnce({
      error: {
        code: "VERSION_CONFLICT",
        message:
          "Seu perfil foi alterado em outra aba. Recarregue antes de continuar.",
        status: 409,
      },
      status: "error",
    });

    render(<TherapistProfileEditorPage editor={makeEditor()} />);

    fireEvent.change(screen.getByLabelText("Nome do perfil"), {
      target: { value: "Ana em conflito" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Seu perfil foi alterado em outra aba. Recarregue antes de continuar.",
    );
    expect(
      screen.getByRole("button", { name: "Salvar alterações" }),
    ).not.toBeDisabled();
  });

  it("focuses the first invalid field and does not call the backend", () => {
    render(<TherapistProfileEditorPage editor={makeEditor()} />);

    fireEvent.change(screen.getByLabelText("Nome do perfil"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Informe o nome do perfil antes de salvar.",
    );
    expect(screen.getByLabelText("Nome do perfil")).toHaveFocus();
    expect(commandMocks.sendTherapistProfileCommand).not.toHaveBeenCalled();
  });

  it("keeps locked capabilities visible but non-editable", () => {
    render(
      <TherapistProfileEditorPage
        editor={makeEditor({
          capabilities: {
            canPublishAdditionalServices: true,
            canPublishProfile: true,
            canUploadVideo: false,
            canUseAdvancedSections: false,
            canUseFeaturedMedia: false,
          },
          derived: { plan: "free" },
        })}
      />,
    );

    expect(
      screen.getByText(
        "Vídeo de apresentação está disponível para planos Premium e Premium Plus.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Enviar novo vídeo" }),
    ).not.toBeInTheDocument();
  });
});
