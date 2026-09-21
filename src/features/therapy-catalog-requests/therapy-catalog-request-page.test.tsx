import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import {
  TherapyCatalogRequestPage,
  type TherapyRequestSummary,
} from "./therapy-catalog-request-page";

const request: TherapyRequestSummary = {
  createdAt: "2026-08-27T12:00:00.000Z",
  decision: "Inclua os materiais que ficaram pendentes.",
  id: "request-1",
  informedName: "Prática de acolhimento",
  materials: [],
  status: "needs_information",
  submission: {
    description: "Uma prática guiada de acolhimento.",
    experienceLevel: "one_to_three",
    guaranteesResults: false,
    hasTraining: true,
    invasiveProcedure: false,
    objective: "Apoiar momentos de reflexão.",
    practicesProfessionally: true,
    requiresInPerson: false,
    sessionProcess: "A conversa acontece em etapas guiadas.",
    themeIds: ["theme-1"],
    useCases: "Pessoas que desejam conversar sobre o momento atual.",
  },
  updatedAt: "2026-08-27T12:00:00.000Z",
};

function renderValidResubmission() {
  return render(
    <TherapyCatalogRequestPage
      initialRequestId={request.id}
      requests={[request]}
      themes={[
        {
          description: "Conversas de acolhimento e reflexão.",
          id: "theme-1",
          name: "Autoconhecimento",
          slug: "autoconhecimento",
          sortOrder: 1,
        },
      ]}
    />,
  );
}

function renderNewRequest() {
  return render(
    <TherapyCatalogRequestPage
      initialRequestId={null}
      requests={[]}
      themes={[
        {
          description: "Conversas de acolhimento e reflexão.",
          id: "theme-1",
          name: "Autoconhecimento",
          slug: "autoconhecimento",
          sortOrder: 1,
        },
      ]}
    />,
  );
}

function openConfirmation() {
  for (let step = 1; step <= 4; step += 1)
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));

  fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));
}

describe("TherapyCatalogRequestPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("presents the introductory guidance before starting a new request", () => {
    renderNewRequest();

    expect(screen.getByTestId("therapy-request-intro")).toBeVisible();
    expect(
      screen.getByText(
        "Acreditamos que o universo terapêutico está em constante evolução.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Nossa equipe irá conhecê-la, analisá-la e verificar se ela faz sentido para a plataforma.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Todas as práticas passam por uma análise de alinhamento com os princípios do TES antes de serem disponibilizadas.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Fechar solicitação" }),
    ).toHaveAttribute("href", "/terapeuta/servicos");

    fireEvent.click(
      screen.getByRole("button", { name: "Iniciar solicitação" }),
    );

    expect(
      screen.getByRole("list", { name: "Etapas da solicitação" }),
    ).toBeVisible();
    expect(
      screen.getByRole("complementary", {
        name: "Orientações sobre a solicitação",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Preencha as informações sobre a prática que você utiliza. Nossa equipe irá analisá-la com carinho.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Todas as práticas passam por uma análise de alinhamento com os princípios do TES antes de serem disponibilizadas.",
      ),
    ).toBeVisible();
    expect(screen.queryByTestId("therapy-request-intro")).toBeNull();
  });

  it("shows character limits and counters for text fields", () => {
    renderNewRequest();
    fireEvent.click(
      screen.getByRole("button", { name: "Iniciar solicitação" }),
    );

    const name = screen.getByRole("textbox", { name: /nome da prática/i });
    expect(name).toHaveAttribute("maxLength", "30");
    expect(screen.getByText("0/30 caracteres")).toBeVisible();

    fireEvent.change(name, { target: { value: "Mesa Radiônica" } });
    expect(screen.getByText("14/30 caracteres")).toBeVisible();
  });

  it("marks missing required fields as errors and focuses the first one", async () => {
    renderNewRequest();
    fireEvent.click(
      screen.getByRole("button", { name: "Iniciar solicitação" }),
    );

    const name = screen.getByRole("textbox", { name: /nome da prática/i });
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));

    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveClass("border-state-danger");
    expect(
      screen.getAllByText("Preencha este campo para continuar."),
    ).toHaveLength(1);
    expect(screen.getByText("Nome da prática", { selector: "label" })).toHaveClass(
      "text-state-danger",
    );
    expect(screen.getByRole("button", { name: /Autoconhecimento/i })).toHaveClass(
      "border-state-danger",
    );

    await waitFor(() => expect(name).toHaveFocus());
  });

  it("advances with a complete step and preserves text entered after an error", () => {
    renderNewRequest();
    fireEvent.click(
      screen.getByRole("button", { name: "Iniciar solicitação" }),
    );

    const name = screen.getByRole("textbox", { name: /nome da prática/i });
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    fireEvent.change(name, { target: { value: "Mesa Radiônica" } });
    fireEvent.click(screen.getByRole("button", { name: /Autoconhecimento/i }));
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));

    expect(screen.getByText("2. Entendendo a terapia")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByRole("textbox", { name: /nome da prática/i })).toHaveValue(
      "Mesa Radiônica",
    );
  });

  it("uses the configured limits throughout the request flow", () => {
    renderValidResubmission();

    expect(screen.getByRole("textbox", { name: /Nome da prática/i })).toHaveAttribute(
      "maxLength",
      "30",
    );
    expect(screen.getByRole("textbox", { name: /Outro nome/i })).toHaveAttribute(
      "maxLength",
      "80",
    );

    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByRole("textbox", { name: /Como você descreveria/i })).toHaveAttribute(
      "maxLength",
      "600",
    );
    expect(screen.getByRole("textbox", { name: /principal objetivo/i })).toHaveAttribute(
      "maxLength",
      "180",
    );
    expect(screen.getByRole("textbox", { name: /Em quais situações/i })).toHaveAttribute(
      "maxLength",
      "600",
    );
    expect(screen.getByRole("textbox", { name: /Como normalmente acontece/i })).toHaveAttribute(
      "maxLength",
      "800",
    );

    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByRole("textbox", { name: /Onde foi sua formação/i })).toHaveAttribute(
      "maxLength",
      "120",
    );
    expect(screen.getByRole("textbox", { name: /Há quanto tempo você atende/i })).toHaveAttribute(
      "maxLength",
      "50",
    );

    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByRole("textbox", { name: /cuidado ou limitação/i })).toHaveAttribute(
      "maxLength",
      "600",
    );

    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByRole("textbox", { name: /site, livro ou referência/i })).toHaveAttribute(
      "maxLength",
      "500",
    );
    expect(screen.getByRole("textbox", { name: /mais alguma informação/i })).toHaveAttribute(
      "maxLength",
      "500",
    );
  });

  it("requires an explicit confirmation before sending and shows success only after a positive response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: { requestId: request.id }, ok: true }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      ),
    );
    vi.stubGlobal("crypto", { randomUUID: () => "request-key" });
    vi.stubGlobal("fetch", fetchMock);

    renderValidResubmission();
    openConfirmation();

    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(screen.getByText("Antes de enviar sua sugestão")).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();

    const confirm = screen.getByRole("button", {
      name: "Confirmar e enviar",
    });
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    expect(await screen.findByText("Recebemos sua solicitação!")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the confirmation dialog open when the request is rejected", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "Não foi possível enviar a solicitação agora." },
          ok: false,
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 422,
        },
      ),
    );
    vi.stubGlobal("crypto", { randomUUID: () => "request-key" });
    vi.stubGlobal("fetch", fetchMock);

    renderValidResubmission();
    openConfirmation();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar e enviar" }));

    expect(
      await screen.findByText("Não foi possível enviar a solicitação agora."),
    ).toBeVisible();
    expect(screen.getByText("Antes de enviar sua sugestão")).toBeVisible();
    expect(screen.queryByText("Recebemos sua solicitação!")).toBeNull();
  });
});
