import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parsePriceToCents } from "./components/therapist-service-form";
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

  it("filters services by status", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Filtrar por status"), {
      target: { value: "paused" },
    });

    expect(screen.getByText("Tarô de clareza")).toBeInTheDocument();
    expect(screen.queryByText("Reiki inicial")).not.toBeInTheDocument();
  });

  it("does not allow creating a service from free text", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /novo serviço/i }));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

    expect(
      screen.getByText("Escolha uma terapia da plataforma."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /criar terapia/i }),
    ).not.toBeInTheDocument();
    expect(mockedCommand).not.toHaveBeenCalled();
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

    fireEvent.click(screen.getByRole("button", { name: /novo serviço/i }));
    fireEvent.click(screen.getByRole("option", { name: /Aromaterapia/i }));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    fireEvent.change(screen.getByLabelText("Título da oferta"), {
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
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    fireEvent.click(screen.getByRole("button", { name: /salvar rascunho/i }));

    await waitFor(() => {
      expect(mockedCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "create",
          priceCents: 12000,
          therapyId: "22222222-2222-4222-8222-222222222229",
        }),
      );
    });
    expect(mockedCommand.mock.calls[0]?.[0]).not.toHaveProperty("therapyName");
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
    fireEvent.click(screen.getByRole("button", { name: "Ativar serviço" }));

    await waitFor(() => {
      expect(mockedCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "activate",
          expectedVersion: 2,
          serviceId: active.serviceId,
        }),
      );
    });
    expect(
      await screen.findByRole("button", { name: /Pausar Reiki inicial/i }),
    ).toBeInTheDocument();
  });
});

describe("parsePriceToCents", () => {
  it("converts Brazilian decimal prices safely", () => {
    expect(parsePriceToCents("R$ 120,00")).toBe(12000);
    expect(parsePriceToCents("1.234,56")).toBe(123456);
    expect(parsePriceToCents("valor livre")).toBeNull();
  });
});

function renderPage() {
  render(
    <TherapistServicesPage
      catalog={catalogFixture()}
      services={{
        contractVersion: 1,
        items: [
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
    category: {
      id: "c1000000-0000-4000-8000-000000000001",
      name: "Terapias Energéticas",
      slug: "terapias-energeticas",
    },
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
    onlineOnly: true,
    position: 10,
    priceCents: 12000,
    serviceId: "d1000000-0000-4000-8000-000000000001",
    status: "draft",
    therapy: {
      id: therapyId,
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
        category: {
          id: "c1000000-0000-4000-8000-000000000001",
          name: "Terapias Energéticas",
          slug: "terapias-energeticas",
        },
        isAvailableForServices: true,
        isPubliclyVisible: true,
        isVisibleInMatching: true,
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
