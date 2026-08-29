import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

function openConfirmation() {
  for (let step = 1; step <= 4; step += 1)
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));

  fireEvent.click(
    screen.getByRole("button", { name: "Enviar solicitação" }),
  );
}

describe("TherapyCatalogRequestPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("requires an explicit confirmation before sending and shows success only after a positive response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { requestId: request.id }, ok: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
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
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar e enviar" }),
    );

    expect(
      await screen.findByText("Não foi possível enviar a solicitação agora."),
    ).toBeVisible();
    expect(screen.getByText("Antes de enviar sua sugestão")).toBeVisible();
    expect(screen.queryByText("Recebemos sua solicitação!")).toBeNull();
  });
});
