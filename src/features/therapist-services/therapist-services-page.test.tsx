import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parsePriceToCents } from "./components/therapist-service-form";
import { TherapistServiceForm } from "./components/therapist-service-form";
import { TherapistServicesPage } from "./components/therapist-services-page";
import { sendTherapistServicesCommand } from "./therapist-services.commands";
import type {
  TherapistServiceSummary,
  TherapyCatalogContract,
} from "./therapist-services.types";

vi.mock("./therapist-services.commands", () => ({
  createStableRequestId: () => "11111111-1111-4111-8111-111111111111",
  sendTherapistServicesCommand: vi.fn(),
}));

const mockedCommand = vi.mocked(sendTherapistServicesCommand);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TherapistServicesPage", () => {
  it("renders services without inventing metric deltas", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Suas terapias" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Ainda sem dados").length).toBeGreaterThan(0);
    expect(screen.queryByText("+20%")).not.toBeInTheDocument();
    expect(screen.queryByText("Interesses")).not.toBeInTheDocument();
  });

  it("renders the platform therapy image managed by admin", () => {
    renderPage({
      items: [
        serviceFixture({
          therapy: {
            id: "22222222-2222-4222-8222-222222222227",
            imageUrl: "https://cdn.example.test/reiki-admin.jpg",
            isAvailableForServices: true,
            isPubliclyVisible: true,
            name: "Reiki",
            slug: "reiki",
            status: "published",
          },
        }),
      ],
    });

    expect(
      screen.getByRole("img", { name: "Imagem da terapia Reiki" }),
    ).toHaveAttribute("src", "https://cdn.example.test/reiki-admin.jpg");
  });

  it("renders therapy photos in the most-booked services card", () => {
    renderPage({
      items: [
        serviceFixture({
          metrics: {
            bookingCount: 4,
            bookingCountDeltaPercent: null,
            bookingsLast30Days: 3,
          },
          therapy: {
            id: "22222222-2222-4222-8222-222222222227",
            imageUrl: "https://cdn.example.test/reiki-ranking.jpg",
            isAvailableForServices: true,
            isPubliclyVisible: true,
            name: "Reiki",
            slug: "reiki",
            status: "published",
          },
        }),
      ],
    });

    const ranking = screen
      .getByRole("heading", { name: "Terapias mais agendadas" })
      .closest("section");

    expect(ranking).not.toBeNull();
    expect(
      within(ranking as HTMLElement).getByRole("img", {
        name: "Imagem da terapia Reiki",
      }),
    ).toHaveAttribute("src", "https://cdn.example.test/reiki-ranking.jpg");
  });

  it("shows the primary theme once and the remaining themes accessibly", () => {
    renderPage({
      items: [
        serviceFixture({
          matching: {
            interestIds: [],
            themeIds: [
              "71000000-0000-4000-8000-000000000002",
              "71000000-0000-4000-8000-000000000003",
            ],
          },
          therapy: {
            id: "22222222-2222-4222-8222-222222222229",
            imageUrl: null,
            isAvailableForServices: true,
            isPubliclyVisible: true,
            name: "Aromaterapia",
            slug: "aromaterapia",
            status: "published",
          },
          therapyId: "22222222-2222-4222-8222-222222222229",
        }),
      ],
    });

    expect(screen.getAllByText("Autoconhecimento")).toHaveLength(1);
    const moreThemes = screen.getByRole("button", {
      name: /ver mais 1 tema/i,
    });
    expect(moreThemes).toHaveTextContent("+1");
    expect(moreThemes).toHaveClass("min-h-11");
    expect(screen.getByRole("tooltip")).toHaveClass("hidden");

    fireEvent.mouseEnter(moreThemes);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Espiritualidade");
  });

  it("contains an unbroken service description inside the card", () => {
    const longWord = "x".repeat(200);
    renderPage({ items: [serviceFixture({ description: longWord })] });

    expect(screen.getByText(longWord)).toHaveClass("break-words");
  });

  it("filters services by status", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Filtrar por status"), {
      target: { value: "paused" },
    });

    expect(screen.getByText("Tarô Terapêutico")).toBeInTheDocument();
    expect(screen.queryByText("Tarô de clareza")).not.toBeInTheDocument();
    expect(screen.queryByText("Reiki inicial")).not.toBeInTheDocument();
  });

  it("keeps archived services out of the default list", () => {
    renderPage({
      items: [
        serviceFixture({ status: "active", title: "Reiki inicial" }),
        serviceFixture({
          blockingReason: "service_archived",
          serviceId: "d1000000-0000-4000-8000-000000000009",
          status: "archived",
          therapy: {
            id: "22222222-2222-4222-8222-222222222226",
            imageUrl: null,
            isAvailableForServices: false,
            isPubliclyVisible: false,
            name: "Aromaterapia",
            slug: "aromaterapia",
            status: "published",
          },
          therapyId: "22222222-2222-4222-8222-222222222226",
          title: "Aromaterapia",
        }),
      ],
    });

    expect(screen.queryByText("Aromaterapia")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filtrar por status"), {
      target: { value: "archived" },
    });

    expect(screen.getByText("Aromaterapia")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Esta terapia foi arquivada e permanece apenas para histórico.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("service_archived")).not.toBeInTheDocument();
  });

  it("does not allow creating a service from free text", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /adicionar terapia/i }));
    expect(
      screen.getByRole("img", { name: "Imagem da terapia Aromaterapia" }),
    ).toHaveAttribute("src", "https://cdn.example.test/aromaterapia.jpg");
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

    expect(
      screen.getByText("Escolha uma terapia da plataforma."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /criar terapia/i }),
    ).not.toBeInTheDocument();
    expect(mockedCommand).not.toHaveBeenCalled();
  });

  it("uses clear attendance copy in the create dialog", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /adicionar terapia/i }));
    fireEvent.click(screen.getByRole("option", { name: /Aromaterapia/i }));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    fireEvent.click(screen.getByLabelText(/Emoções e bem-estar/i));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

    expect(
      screen.getByRole("heading", { name: "Novo serviço" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Crie um atendimento para uma terapia já aprovada no TES.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Como esse atendimento vai aparecer?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Escolha um nome simples, que ajude a pessoa a entender o atendimento.",
      ),
    ).toBeInTheDocument();
    const titleInput = screen.getByLabelText("Nome do atendimento");
    expect(titleInput).toHaveValue("");
    expect(titleInput).toHaveAttribute(
      "placeholder",
      "Exemplo: Sessão individual de Reiki — 45 min",
    );
    expect(screen.getByLabelText("Descrição")).toHaveAttribute(
      "placeholder",
      expect.stringContaining("Exemplo de descrição:"),
    );
    expect(
      screen.getByText(
        /Conte como funciona o atendimento e o que a pessoa pode esperar/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Duração")).toHaveAttribute(
      "placeholder",
      "Exemplo: 45 min",
    );
    expect(screen.getByLabelText("Preço")).toHaveAttribute(
      "placeholder",
      "Exemplo: R$ 185",
    );
    expect(
      screen.getByText(
        "Este atendimento acontece online, pelo fluxo seguro do TES.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("3. Atendimento")).toBeInTheDocument();
    expect(screen.queryByText(/oferta/i)).not.toBeInTheDocument();
  });

  it("creates a draft with therapyId and price in cents", async () => {
    mockedCommand.mockResolvedValueOnce({
      data: {
        contractVersion: 1,
        idempotentReplay: false,
        service: serviceFixture({
          serviceId: "d1000000-0000-4000-8000-000000000003",
          therapyId: "22222222-2222-4222-8222-222222222229",
          title: "Aromaterapia acolhedora",
        }),
      },
      status: "success",
    });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /adicionar terapia/i }));
    fireEvent.click(screen.getByRole("option", { name: /Aromaterapia/i }));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    fireEvent.click(screen.getByLabelText(/Emoções e bem-estar/i));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    fireEvent.change(screen.getByLabelText("Nome do atendimento"), {
      target: { value: "Aromaterapia acolhedora" },
    });
    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: {
        value:
          "Experiência olfativa guiada para acolhimento, presença e bem-estar.",
      },
    });
    fireEvent.change(screen.getByLabelText("Preço"), {
      target: { value: "120,00" },
    });
    const duration = screen.getByLabelText("Duração");
    expect(duration).toHaveAttribute("min", "20");
    expect(duration).toHaveAttribute("max", "120");
    expect(duration).toHaveAttribute("step", "1");
    fireEvent.change(duration, { target: { value: "19" } });
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    expect(
      screen.getByText(
        "A duração deve ser um número inteiro entre 20 e 120 minutos.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(duration, { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    fireEvent.click(screen.getByRole("button", { name: /salvar rascunho/i }));

    await waitFor(() => {
      expect(mockedCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "create",
          themeIds: ["71000000-0000-4000-8000-000000000001"],
          priceCents: 12000,
          durationMinutes: 20,
          therapyId: "22222222-2222-4222-8222-222222222229",
        }),
      );
    });
    expect(mockedCommand.mock.calls[0]?.[0]).not.toHaveProperty("therapyName");
  });

  it("explains an activation failure without creating the therapy again", async () => {
    const created = serviceFixture({
      serviceId: "d1000000-0000-4000-8000-000000000004",
      title: "Aromaterapia acolhedora",
    });
    const onClose = vi.fn();
    const onSaved = vi.fn();
    mockedCommand
      .mockResolvedValueOnce({
        data: {
          contractVersion: 1,
          idempotentReplay: false,
          service: created,
        },
        status: "success",
      })
      .mockResolvedValueOnce({
        error: {
          code: "internal_error",
          message: "A ativação não ficou disponível agora.",
        },
        status: "error",
      });

    render(
      <TherapistServiceForm
        catalog={catalogFixture().items}
        mode="create"
        onClose={onClose}
        onSaved={onSaved}
      />,
    );

    fireEvent.click(screen.getByRole("option", { name: /Aromaterapia/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByLabelText(/Emoções e bem-estar/i));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.change(screen.getByLabelText("Nome do atendimento"), {
      target: { value: "Aromaterapia acolhedora" },
    });
    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: {
        value:
          "Experiência olfativa guiada para acolhimento, presença e bem-estar.",
      },
    });
    fireEvent.change(screen.getByLabelText("Preço"), {
      target: { value: "120,00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar e ativar" }));

    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent(
      "A terapia foi salva como rascunho, mas não foi possível ativá-la. A ativação não ficou disponível agora.",
    );
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    const activated = serviceFixture({
      serviceId: created.serviceId,
      status: "active",
      title: created.title,
      version: created.version + 1,
    });
    mockedCommand.mockResolvedValueOnce({
      data: {
        contractVersion: 1,
        idempotentReplay: false,
        service: activated,
      },
      status: "success",
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar e ativar" }));

    await waitFor(() => {
      expect(mockedCommand).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          action: "activate",
          expectedVersion: created.version,
          serviceId: created.serviceId,
        }),
      );
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  it("confirms activation through the service command", async () => {
    const active = serviceFixture({ status: "active", version: 3 });
    mockedCommand.mockResolvedValueOnce({
      data: {
        contractVersion: 1,
        idempotentReplay: false,
        service: active,
      },
      status: "success",
    });
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: /Ativar Reiki inicial/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Ativar terapia" }));

    await waitFor(() => {
      expect(mockedCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "activate",
          expectedVersion: 2,
          serviceId: active.serviceId,
        }),
      );
    });
    expect(await screen.findByText("Terapia ativada.")).toBeInTheDocument();
  });

  it("closes the edit dialog after a successful update", async () => {
    const updatedService = serviceFixture({
      description:
        "Descricao revisada em teste automatizado, sem promessa de resultado.",
      version: 3,
    });
    const onClose = vi.fn();
    const onSaved = vi.fn();

    mockedCommand.mockResolvedValueOnce({
      data: {
        contractVersion: 1,
        idempotentReplay: false,
        service: updatedService,
      },
      status: "success",
    });

    render(
      <TherapistServiceForm
        catalog={catalogFixture().items}
        mode="edit"
        onClose={onClose}
        onSaved={onSaved}
        service={serviceFixture({
          therapyId: "22222222-2222-4222-8222-222222222229",
          therapy: {
            id: "22222222-2222-4222-8222-222222222229",
            imageUrl: "https://cdn.example.test/aromaterapia.jpg",
            isAvailableForServices: true,
            isPubliclyVisible: true,
            name: "Aromaterapia",
            slug: "aromaterapia",
            status: "published",
          },
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: updatedService.description },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(
        updatedService,
        "Terapia atualizada.",
      );
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  it("does not advance when the description is shorter than 20 characters", () => {
    render(
      <TherapistServiceForm
        catalog={catalogFixture().items}
        mode="edit"
        onClose={vi.fn()}
        onSaved={vi.fn()}
        service={serviceFixture()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: "Descrição curta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(
      screen.getByText("A descrição precisa ter pelo menos 20 caracteres."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Salvar alterações" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Descrição")).toHaveFocus();
  });

  it("keeps the dialog open and explains a final save failure", async () => {
    const onClose = vi.fn();
    mockedCommand.mockResolvedValueOnce({
      error: {
        code: "internal_error",
        message: "Não foi possível salvar a terapia agora.",
      },
      status: "error",
    });

    render(
      <TherapistServiceForm
        catalog={catalogFixture().items}
        mode="edit"
        onClose={onClose}
        onSaved={vi.fn()}
        service={serviceFixture()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("Não foi possível salvar a terapia agora.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("bounds an unbroken description in the review step", () => {
    const longWord = "d".repeat(200);

    render(
      <TherapistServiceForm
        catalog={catalogFixture().items}
        mode="edit"
        onClose={vi.fn()}
        onSaved={vi.fn()}
        service={serviceFixture()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: longWord },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText(longWord)).toHaveClass(
      "overflow-y-auto",
      "break-words",
    );
  });
});

describe("parsePriceToCents", () => {
  it("converts Brazilian decimal prices safely", () => {
    expect(parsePriceToCents("R$ 120,00")).toBe(12000);
    expect(parsePriceToCents("1.234,56")).toBe(123456);
    expect(parsePriceToCents("valor livre")).toBeNull();
  });
});

function renderPage(overrides: { items?: TherapistServiceSummary[] } = {}) {
  render(
    <TherapistServicesPage
      catalog={catalogFixture()}
      services={{
        contractVersion: 1,
        items: overrides.items ?? [
          serviceFixture({ status: "draft" }),
          serviceFixture({
            serviceId: "d1000000-0000-4000-8000-000000000002",
            status: "paused",
            therapyId: "22222222-2222-4222-8222-222222222228",
            title: "Tarô de clareza",
          }),
        ],
        plan: "premium_plus",
        serviceLimit: 10,
        therapistProfileId: "a1000000-0000-4000-8000-000000000001",
      }}
    />,
  );
}

function serviceFixture(
  overrides: Partial<TherapistServiceSummary> = {},
): TherapistServiceSummary {
  const therapyId =
    overrides.therapyId ?? "22222222-2222-4222-8222-222222222227";

  return {
    archivedAt: null,
    blockingReason: null,
    createdAt: "2026-07-28T10:00:00.000Z",
    currency: "BRL",
    deliveryFormat: "online",
    description:
      "Experiência conduzida com linguagem acolhedora e proposta bem delimitada.",
    durationMinutes: 60,
    isBookable: false,
    isReservable: false,
    metrics: {
      bookingCount: 0,
      bookingCountDeltaPercent: null,
      bookingsLast30Days: 0,
    },
    matching: {
      interestIds: [],
      themeIds: ["71000000-0000-4000-8000-000000000001"],
    },
    onlineOnly: true,
    position: 10,
    priceCents: 12000,
    serviceId: "d1000000-0000-4000-8000-000000000001",
    status: "draft",
    therapy: {
      id: therapyId,
      imageUrl: null,
      isAvailableForServices: true,
      isPubliclyVisible: true,
      name: overrides.title?.startsWith("Tarô") ? "Tarô Terapêutico" : "Reiki",
      slug: overrides.title?.startsWith("Tarô") ? "taro-terapeutico" : "reiki",
      status: "published",
    },
    therapyId,
    title: "Reiki inicial",
    updatedAt: "2026-07-28T10:00:00.000Z",
    version: 2,
    ...overrides,
  };
}

function catalogFixture(): TherapyCatalogContract {
  return {
    contractVersion: 1,
    items: [
      {
        isAvailableForServices: true,
        isPubliclyVisible: true,
        isVisibleInMatching: true,
        imageUrl: "https://cdn.example.test/aromaterapia.jpg",
        matchingThemes: [
          {
            id: "71000000-0000-4000-8000-000000000001",
            interests: [
              {
                id: "72000000-0000-4000-8000-000000000001",
                name: "Ansiedade",
                slug: "ansiedade",
                sortOrder: 1,
                themeId: "71000000-0000-4000-8000-000000000001",
              },
            ],
            name: "Emoções e bem-estar",
            slug: "emocoes-bem-estar",
            sortOrder: 1,
          },
          {
            id: "71000000-0000-4000-8000-000000000002",
            interests: [],
            name: "Autoconhecimento",
            slug: "autoconhecimento",
            sortOrder: 2,
          },
          {
            id: "71000000-0000-4000-8000-000000000003",
            interests: [],
            name: "Espiritualidade",
            slug: "espiritualidade",
            sortOrder: 3,
          },
        ],
        name: "Aromaterapia",
        shortDescription: "Uso cuidadoso de aromas em uma experiência guiada.",
        slug: "aromaterapia",
        status: "published",
        therapyId: "22222222-2222-4222-8222-222222222229",
      },
    ],
    plan: "premium_plus",
    serviceLimit: 10,
    therapistProfileId: "a1000000-0000-4000-8000-000000000001",
  };
}
