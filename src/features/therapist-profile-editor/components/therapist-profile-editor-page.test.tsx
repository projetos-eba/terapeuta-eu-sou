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
      canCustomizePublicSlug: true,
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
    privateDocuments: [],
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
        essenceBody: "Presença e cuidado.",
        experienceYears: 8,
        guideItems: [{ icon: "sparkles", label: "Escuta acolhedora" }],
        headline: "",
        invitationBody: "",
        photoUrl: "/therapists/ana-oliveira.png",
        publicName: "Ana Oliveira",
        publicProfileTheme: "serene",
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
    verificationSummary: null,
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

function makeFirstConfigurationEditor(
  overrides: EditorOverrides = {},
): TherapistProfileEditorData {
  const base = makeEditor();
  const firstFields = {
    ...base.published.fields,
    bio: "",
    essenceBody: "",
    headline: "",
    invitationBody: "",
    photoUrl: "",
    publicName: "",
    shortIntro: "",
    videoThumbnailUrl: "",
    videoTitle: "",
    videoUrl: "",
  };

  return makeEditor({
    ...overrides,
    derived: {
      publicStatus: "draft",
      ...overrides.derived,
    },
    draft: overrides.draft ?? null,
    published: overrides.published ?? {
      ...base.published,
      fields: firstFields,
      publishedAt: null,
      status: "draft",
    },
    version: overrides.version ?? 1,
  });
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
    expect(screen.getByText("Perfil completo")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Preview do perfil" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Outras partes do seu perfil")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Cada parte fica no lugar certo para você encontrar e atualizar com facilidade.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Dados derivados")).not.toBeInTheDocument();
  });

  it("opens the library and keeps theme selection in the draft state", () => {
    render(<TherapistProfileEditorPage editor={makeEditor()} />);

    expect(screen.getByText("Sereno")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Alterar tema" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Escolha o visual do seu perfil");
    expect(dialog.querySelectorAll("[data-theme-preview]")).toHaveLength(19);

    const naturalCard = screen.getByRole("button", { name: /Natural/ });
    fireEvent.click(naturalCard);
    expect(naturalCard).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Selecionado: Natural")).toBeInTheDocument();
  });

  it("lets Free explore Premium themes and opens the canonical upsell", () => {
    render(
      <TherapistProfileEditorPage
        editor={makeEditor({ derived: { plan: "free" } })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Alterar tema" }));
    fireEvent.click(screen.getByRole("button", { name: /Geometria/ }));

    expect(
      screen.getByRole("heading", { name: "Visual exclusivo do Premium" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Conhecer Premium" }),
    ).toHaveAttribute("href", "/terapeuta/plano");
    expect(commandMocks.sendTherapistProfileCommand).not.toHaveBeenCalled();
  });

  it("keeps Minha essência editable without exposing the retired bio illustration gallery", () => {
    render(<TherapistProfileEditorPage editor={makeEditor()} />);

    expect(screen.getByLabelText("Minha essência")).toHaveValue(
      "Presença e cuidado.",
    );
    fireEvent.change(screen.getByLabelText("Minha essência"), {
      target: { value: "Presença, cuidado e escuta." },
    });
    expect(screen.getByLabelText("Minha essência")).toHaveValue(
      "Presença, cuidado e escuta.",
    );
    expect(screen.queryByText("Ilustração da bio")).not.toBeInTheDocument();
    expect(screen.queryByText("Sem ilustração")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Planta serena")).not.toBeInTheDocument();
  });

  it("keeps the stable link visible and blocks custom slug editing for Free", () => {
    render(
      <TherapistProfileEditorPage
        editor={makeEditor({
          capabilities: { canCustomizePublicSlug: false },
          derived: { plan: "free" },
          publicProfileHref: "/terapeutas/1100001",
          publicProfileSlug: "1100001",
        })}
      />,
    );

    expect(
      screen.getByRole("textbox", { name: /Endereço público/ }),
    ).toHaveValue("1100001");
    expect(
      screen.getByRole("textbox", { name: /Endereço público/ }),
    ).toBeDisabled();
    expect(
      screen.getByText(/identificador numérico continua estável/i),
    ).toBeInTheDocument();
  });

  it("saves a paid slug without discarding unsaved profile fields", async () => {
    const updatedEditor = makeEditor({
      publicProfileHref: "/terapeutas/ana-presenca",
      publicProfileSlug: "ana-presenca",
      version: 5,
    });
    commandMocks.sendTherapistProfileCommand
      .mockResolvedValueOnce({
        data: { normalizedSlug: "ana-presenca", status: "available" },
        status: "success",
      })
      .mockResolvedValueOnce({
        data: { editor: updatedEditor, idempotentReplay: false },
        status: "success",
      });

    render(<TherapistProfileEditorPage editor={makeEditor()} />);
    fireEvent.change(screen.getByLabelText("Nome do perfil"), {
      target: { value: "Ana ainda não salva" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: /Endereço público/ }),
      {
        target: { value: "Ana Presença" },
      },
    );

    await waitFor(() =>
      expect(commandMocks.sendTherapistProfileCommand).toHaveBeenCalledWith({
        action: "check_slug_availability",
        slug: "Ana Presença",
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Salvar link" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar link" }));

    await waitFor(() =>
      expect(commandMocks.sendTherapistProfileCommand).toHaveBeenLastCalledWith(
        expect.objectContaining({
          action: "update_slug",
          slug: "Ana Presença",
        }),
      ),
    );
    expect(screen.getByLabelText("Nome do perfil")).toHaveValue(
      "Ana ainda não salva",
    );
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

    expect(
      screen.getByText(
        "Sua atualização está aguardando a revisão da equipe TES.",
      ),
    ).toBeInTheDocument();
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
    fireEvent.click(
      screen.getAllByRole("button", { name: "Salvar alterações" })[0],
    );

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

  it("uses publication as the primary action during first profile setup", () => {
    render(
      <TherapistProfileEditorPage editor={makeFirstConfigurationEditor()} />,
    );

    expect(
      screen.queryByRole("button", { name: "Salvar alterações" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Publicar alterações" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: "Salvar rascunho" }),
    ).not.toBeInTheDocument();
  });

  it("explains missing required fields before the first profile publication", () => {
    render(
      <TherapistProfileEditorPage editor={makeFirstConfigurationEditor()} />,
    );

    fireEvent.change(screen.getByLabelText("Nome do perfil"), {
      target: { value: "Codex Terapeuta Playwright" },
    });
    fireEvent.change(screen.getByLabelText("Sua apresentação"), {
      target: { value: "Isso é um teste" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Publicar alterações" })[0],
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Preencha sua essência antes de publicar.",
    );
    expect(screen.getByLabelText("Minha essência")).toHaveFocus();
    expect(commandMocks.sendTherapistProfileCommand).not.toHaveBeenCalled();
  });

  it("blocks unsafe video links before sending the first publication", () => {
    render(
      <TherapistProfileEditorPage editor={makeFirstConfigurationEditor()} />,
    );

    fireEvent.change(screen.getByLabelText("Nome do perfil"), {
      target: { value: "Codex Terapeuta Playwright" },
    });
    fireEvent.change(screen.getByLabelText("Sua apresentação"), {
      target: { value: "Isso é um teste" },
    });
    fireEvent.change(screen.getByLabelText("Minha essência"), {
      target: {
        value: "Minha essência completa para a primeira publicação.",
      },
    });
    fireEvent.change(screen.getByLabelText("Inserir link do vídeo"), {
      target: { value: "http://example.test/videos/ana-oliveira" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Publicar alterações" })[0],
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Use um link https:// do YouTube ou Vimeo.",
    );
    expect(commandMocks.sendTherapistProfileCommand).not.toHaveBeenCalled();
  });

  it("saves and publishes the first complete profile setup in one confirmed action", async () => {
    commandMocks.createStableRequestId
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");

    const firstEditor = makeFirstConfigurationEditor();
    const savedEditor = makeFirstConfigurationEditor({
      draft: {
        baseProfileVersion: 1,
        contentVersionId: "first-draft-version",
        fields: {
          ...firstEditor.published.fields,
          essenceBody: "Minha essência completa para a primeira publicação.",
          publicName: "Codex Terapeuta Playwright",
          shortIntro: "Isso é um teste",
        },
        publishedAt: null,
        status: "draft",
        updatedAt: "2026-08-07T13:41:00.000Z",
      },
      version: 2,
    });
    const publishedEditor = makeEditor({
      draft: null,
      published: {
        ...makeEditor().published,
        fields: savedEditor.draft!.fields,
        publishedAt: "2026-08-07T13:42:00.000Z",
        status: "published",
      },
      version: 3,
    });
    commandMocks.sendTherapistProfileCommand
      .mockResolvedValueOnce({
        data: { editor: savedEditor, idempotentReplay: false },
        status: "success",
      })
      .mockResolvedValueOnce({
        data: { editor: publishedEditor, idempotentReplay: false },
        status: "success",
      });

    render(<TherapistProfileEditorPage editor={firstEditor} />);

    fireEvent.change(screen.getByLabelText("Nome do perfil"), {
      target: { value: "Codex Terapeuta Playwright" },
    });
    fireEvent.change(screen.getByLabelText("Sua apresentação"), {
      target: { value: "Isso é um teste" },
    });
    fireEvent.change(screen.getByLabelText("Minha essência"), {
      target: {
        value: "Minha essência completa para a primeira publicação.",
      },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Publicar alterações" })[0],
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Publicar alterações?",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Publicar alterações" }),
    );

    await waitFor(() => {
      expect(commandMocks.sendTherapistProfileCommand).toHaveBeenCalledTimes(2);
    });
    expect(commandMocks.sendTherapistProfileCommand).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: "save_draft",
        expectedVersion: 1,
        requestId: "11111111-1111-4111-8111-111111111111",
      }),
    );
    expect(commandMocks.sendTherapistProfileCommand).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: "publish",
        expectedVersion: 2,
        requestId: "22222222-2222-4222-8222-222222222222",
      }),
    );
    expect(
      screen.getAllByText(/Alterações enviadas para revisão/).length,
    ).toBeGreaterThan(0);
  });

  it("creates a draft before publishing a complete first profile without local edits", async () => {
    commandMocks.createStableRequestId
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");

    const base = makeFirstConfigurationEditor();
    const readyFields = {
      ...base.published.fields,
      essenceBody: "Minha essência completa para a primeira publicação.",
      guideItems: [{ icon: "sparkles", label: "Escuta acolhedora" }],
      publicName: "Ana Oliveira",
      shortIntro: "Acolhimento online com clareza.",
    };
    const readyEditor = makeFirstConfigurationEditor({
      published: {
        ...base.published,
        fields: readyFields,
      },
    });
    const savedEditor = makeFirstConfigurationEditor({
      draft: {
        baseProfileVersion: 1,
        contentVersionId: "first-draft-version",
        fields: readyFields,
        publishedAt: null,
        status: "draft",
        updatedAt: "2026-08-07T13:41:00.000Z",
      },
      published: readyEditor.published,
      version: 1,
    });
    const publishedEditor = makeEditor({
      draft: null,
      published: {
        ...makeEditor().published,
        fields: readyFields,
        publishedAt: "2026-08-07T13:42:00.000Z",
        status: "published",
      },
      version: 2,
    });
    commandMocks.sendTherapistProfileCommand
      .mockResolvedValueOnce({
        data: { editor: savedEditor, idempotentReplay: false },
        status: "success",
      })
      .mockResolvedValueOnce({
        data: { editor: publishedEditor, idempotentReplay: false },
        status: "success",
      });

    render(<TherapistProfileEditorPage editor={readyEditor} />);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Publicar alterações" })[0],
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Publicar alterações?",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Publicar alterações" }),
    );

    await waitFor(() => {
      expect(commandMocks.sendTherapistProfileCommand).toHaveBeenCalledTimes(2);
    });
    expect(commandMocks.sendTherapistProfileCommand).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: "save_draft",
        expectedVersion: 1,
      }),
    );
    expect(commandMocks.sendTherapistProfileCommand).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: "publish",
        expectedVersion: 1,
      }),
    );
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
    expect(dialog).toHaveTextContent(
      /confirme em Configurações se seus dados e documentos obrigatórios estão completos/i,
    );
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
    expect(
      screen.getAllByText(/Alterações enviadas para revisão/).length,
    ).toBeGreaterThan(0);
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
    fireEvent.click(
      screen.getAllByRole("button", { name: "Salvar alterações" })[0],
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Seu perfil foi alterado em outra aba. Recarregue antes de continuar.",
    );
    expect(
      screen.getAllByRole("button", { name: "Salvar alterações" })[0],
    ).not.toBeDisabled();
  });

  it("shows the actionable reason returned for an invalid profile field", async () => {
    commandMocks.sendTherapistProfileCommand.mockResolvedValueOnce({
      error: {
        code: "VALIDATION_ERROR",
        message:
          "Use um link https:// do YouTube ou Vimeo, ou envie um vídeo válido.",
        status: 422,
      },
      status: "error",
    });

    render(<TherapistProfileEditorPage editor={makeEditor()} />);

    fireEvent.change(screen.getByLabelText("Nome do perfil"), {
      target: { value: "Ana com vídeo inválido" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Salvar alterações" })[0],
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Use um link https:// do YouTube ou Vimeo, ou envie um vídeo válido.",
    );
  });

  it("focuses the first invalid field and does not call the backend", () => {
    render(<TherapistProfileEditorPage editor={makeEditor()} />);

    fireEvent.change(screen.getByLabelText("Nome do perfil"), {
      target: { value: "" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Salvar alterações" })[0],
    );

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
