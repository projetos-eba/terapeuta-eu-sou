import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminTherapyEditor } from "./admin-therapy-editor";

describe("AdminTherapyEditor", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("submits semantic color and structured benefits without FAQ fields", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <AdminTherapyEditor
        isSaving={false}
        matchingThemes={[
          {
            id: "theme-1",
            imageUrl: "/journey/emocoes-bem-estar.png",
            name: "Emoções e Bem-Estar",
            slug: "emocoes-bem-estar",
            sortOrder: 1,
          },
          {
            id: "theme-2",
            imageUrl: "/journey/relacionamentos.png",
            name: "Relacionamentos",
            slug: "relacionamentos",
            sortOrder: 2,
          },
          {
            id: "theme-3",
            imageUrl: "/journey/autoconhecimento-transformacao.png",
            name: "Autoconhecimento e Transformação",
            slug: "autoconhecimento-transformacao",
            sortOrder: 3,
          },
          {
            id: "theme-4",
            imageUrl: "/journey/proposito-direcao.png",
            name: "Propósito e Direção",
            slug: "proposito-direcao",
            sortOrder: 4,
          },
        ]}
        onCancel={() => undefined}
        onSave={onSave}
        therapy={null}
      />,
    );

    expect(screen.getByTitle("Emoções e Bem-Estar")).toHaveAttribute(
      "src",
      "/journey/emocoes-bem-estar.png",
    );

    fireEvent.change(screen.getByLabelText("Nome canônico"), {
      target: { value: "Reiki" },
    });
    fireEvent.change(screen.getByLabelText("Slug"), {
      target: { value: "reiki" },
    });
    fireEvent.change(document.querySelector<HTMLTextAreaElement>('textarea[name="shortDescription"]')!, {
      target: { value: "Prática complementar de cuidado energético." },
    });
    fireEvent.change(
      screen.getByRole("combobox", { name: /chave semântica de cor/i }),
      {
        target: { value: "green" },
      },
    );
    const semanticIcon = document.querySelector<HTMLSelectElement>(
      'select[name="approachIconKey"]',
    );
    expect(semanticIcon).not.toBeNull();
    expect(semanticIcon).toHaveAttribute("name", "approachIconKey");
    expect(semanticIcon).toHaveValue("sparkles");
    fireEvent.change(semanticIcon!, { target: { value: "compass" } });
    fireEvent.change(screen.getByLabelText("Benefício 1"), {
      target: { value: "Pausa de presença" },
    });
    fireEvent.change(screen.getByLabelText("Ícone visual 1"), {
      target: { value: "pause" },
    });
    fireEvent.change(screen.getByLabelText("Benefício 2"), {
      target: { value: "Cuidado energético complementar" },
    });
    fireEvent.change(screen.getByLabelText("Ícone visual 2"), {
      target: { value: "energy" },
    });
    expect(screen.queryByText("FAQs")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Emoções e Bem-Estar"));
    fireEvent.click(screen.getByLabelText("Relacionamentos"));
    fireEvent.click(screen.getByLabelText("Autoconhecimento e Transformação"));
    expect(screen.getByLabelText("Propósito e Direção")).toBeDisabled();
    const reasonField = document.querySelector<HTMLTextAreaElement>(
      'textarea[name="reason"]',
    );
    expect(reasonField).not.toBeNull();
    fireEvent.change(reasonField!, {
      target: { value: "Cadastro editorial inicial." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        benefits: [
          {
            description: null,
            iconKey: "pause",
            title: "Pausa de presença",
          },
          {
            description: null,
            iconKey: "energy",
            title: "Cuidado energético complementar",
          },
        ],
        calendarColorKey: "green",
        publicContent: expect.objectContaining({ approachIconKey: "compass" }),
        themeIds: ["theme-1", "theme-2", "theme-3"],
      }),
    );
  });

  it("shows the configured limits and blocks an overlong field", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <AdminTherapyEditor
        isSaving={false}
        matchingThemes={[{ id: "theme-1", imageUrl: null, name: "Tema", slug: "tema", sortOrder: 1 }]}
        onCancel={() => undefined}
        onSave={onSave}
        therapy={null}
      />,
    );

    expect(document.querySelector('textarea[name="shortDescription"]')).toHaveAttribute("maxLength", "100");
    expect(document.querySelector('textarea[name="description"]')).toHaveAttribute("maxLength", "200");
    expect(document.querySelector('textarea[name="introduction"]')).toHaveAttribute("maxLength", "160");
    expect(document.querySelector('textarea[name="complementaryDescription"]')).toHaveAttribute("maxLength", "200");
    expect(document.querySelector('textarea[name="safetyNote"]')).toHaveAttribute("maxLength", "150");
    expect(document.querySelector('input[name="benefitDescription"]')).toHaveAttribute("maxLength", "100");

    fireEvent.change(screen.getByLabelText("Nome canônico"), { target: { value: "Reiki" } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "reiki" } });
    fireEvent.change(screen.getByLabelText("Benefício 1"), { target: { value: "Pausa" } });
    fireEvent.change(screen.getByLabelText("Benefício 2"), { target: { value: "Cuidado" } });
    fireEvent.change(document.querySelector<HTMLTextAreaElement>('textarea[name="reason"]')!, { target: { value: "Cadastro inicial." } });
    fireEvent.change(document.querySelector<HTMLTextAreaElement>('textarea[name="shortDescription"]')!, { target: { value: "r".repeat(101) } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    expect(await screen.findByText("O resumo deve ter no máximo 100 caracteres.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("uploads a therapy image and fills fallback and hero URLs", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { publicUrl: "https://media.test/therapies/reiki.png" },
          ok: true,
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminTherapyEditor
        isSaving={false}
        matchingThemes={[]}
        onCancel={() => undefined}
        onSave={onSave}
        therapy={null}
      />,
    );

    fireEvent.change(screen.getByLabelText("Selecionar imagem da terapia"), {
      target: {
        files: [
          new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "reiki.png", {
            type: "image/png",
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Imagem fallback")).toHaveValue(
        "https://media.test/therapies/reiki.png",
      );
      expect(screen.getByLabelText("Imagem hero")).toHaveValue(
        "https://media.test/therapies/reiki.png",
      );
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/media",
      expect.objectContaining({ method: "POST" }),
    );
    expect(screen.getByAltText("Prévia da imagem da terapia")).toHaveAttribute(
      "src",
      "https://media.test/therapies/reiki.png",
    );

    const dropzone = screen
      .getByText("Escolha uma imagem ou arraste e solte aqui")
      .closest("label");
    expect(dropzone).not.toBeNull();
    fireEvent.drop(dropzone!, {
      dataTransfer: {
        files: [
          new File([new Uint8Array([0x52, 0x49, 0x46, 0x46])], "reiki.webp", {
            type: "image/webp",
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
