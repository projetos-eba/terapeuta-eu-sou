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
  });

  it("submits semantic color, structured benefits and structured FAQs", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <AdminTherapyEditor
        categories={[
          {
            id: "category-1",
            isActive: true,
            name: "Energia",
            slug: "energia",
            sortOrder: 1,
          },
        ]}
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
    fireEvent.change(screen.getByLabelText("Resumo"), {
      target: { value: "Prática complementar de cuidado energético." },
    });
    fireEvent.change(
      screen.getByRole("combobox", { name: /chave semântica de cor/i }),
      {
        target: { value: "green" },
      },
    );
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
    fireEvent.change(screen.getByLabelText("Pergunta 1"), {
      target: { value: "Como acontece online?" },
    });
    fireEvent.change(screen.getByLabelText("Resposta"), {
      target: {
        value: "A sessão acontece por vídeo, com orientação do terapeuta.",
      },
    });
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
        faqs: [
          {
            answer: "A sessão acontece por vídeo, com orientação do terapeuta.",
            question: "Como acontece online?",
          },
        ],
        themeIds: ["theme-1", "theme-2", "theme-3"],
      }),
    );
  });
});
