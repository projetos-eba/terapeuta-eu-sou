import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sendTherapistReviewCommand } from "../therapist-reviews.commands";
import type { TherapistReviewsPageData } from "../therapist-reviews.types";
import { TherapistReviewsPage } from "./therapist-reviews-page";

vi.mock("../therapist-reviews.commands", () => ({
  createStableRequestId: () => "11111111-1111-4111-8111-111111111111",
  sendTherapistReviewCommand: vi.fn(),
}));

const mockedCommand = vi.mocked(sendTherapistReviewCommand);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TherapistReviewsPage", () => {
  it("renders metrics and filters pending replies", () => {
    render(<TherapistReviewsPage initialData={pageFixture()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Avaliações" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nota média")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Avaliações recebidas",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Resumo das avaliações",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("tab", { name: /Pendentes de resposta/i }),
    );

    expect(screen.getByText("Marina Souza")).toBeInTheDocument();
    expect(screen.queryByText("Beatriz Lima")).not.toBeInTheDocument();
  });

  it("publishes a therapist reply and updates the list", async () => {
    mockedCommand.mockResolvedValueOnce({
      data: {
        idempotentReplay: false,
        page: pageFixture({
          reviews: [
            {
              ...reviewFixture({ patientName: "Marina Souza" }),
              reply: {
                body: "Obrigada por compartilhar sua experiência.",
                id: "77777777-7777-4777-8777-777777777777",
                publishedAt: "2026-07-28T16:30:00.000Z",
                status: "published",
              },
              responseStatus: "responded",
            },
          ],
        }),
      },
      status: "success",
    });

    render(<TherapistReviewsPage initialData={pageFixture()} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Responder" })[0]);
    fireEvent.change(screen.getByLabelText("Resposta"), {
      target: { value: "Obrigada por compartilhar sua experiência." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Publicar resposta/i }));

    await waitFor(() => {
      expect(mockedCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "reply",
          body: "Obrigada por compartilhar sua experiência.",
          requestId: "11111111-1111-4111-8111-111111111111",
        }),
      );
    });
    expect(
      await screen.findAllByText("Resposta publicada no seu perfil público."),
    ).toHaveLength(2);
    expect(screen.getByText("Sua resposta")).toBeInTheDocument();
  });

  it("keeps validation errors attached to the reply field", () => {
    render(<TherapistReviewsPage initialData={pageFixture()} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Responder" })[0]);
    fireEvent.change(screen.getByLabelText("Resposta"), {
      target: { value: "ok" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Publicar resposta/i }));

    expect(
      screen.getByText("Escreva uma resposta entre 3 e 600 caracteres."),
    ).toBeInTheDocument();
    expect(mockedCommand).not.toHaveBeenCalled();
  });
});

function pageFixture(
  overrides: Partial<TherapistReviewsPageData> = {},
): TherapistReviewsPageData {
  return {
    distribution: [
      { count: 2, rating: 5 },
      { count: 0, rating: 4 },
      { count: 0, rating: 3 },
      { count: 0, rating: 2 },
      { count: 0, rating: 1 },
    ],
    generatedAt: "2026-07-28T16:00:00.000Z",
    metricCards: [
      {
        helper: "Baseado em 2 avaliações",
        key: "average",
        label: "Nota média",
        trend: { direction: "flat", value: null },
        value: "5,0",
      },
      {
        helper: "2 pacientes",
        key: "total",
        label: "Total de avaliações",
        trend: { direction: "flat", value: null },
        value: "2",
      },
      {
        helper: "50% respondidas",
        key: "responded",
        label: "Avaliações respondidas",
        trend: { direction: "up", value: 1 },
        value: "1",
      },
      {
        helper: "2 avaliações positivas",
        key: "positive",
        label: "Avaliações positivas",
        trend: { direction: "flat", value: null },
        value: "100%",
      },
    ],
    metrics: {
      averageRating: 5,
      distinctPatients: 2,
      pendingReplies: 1,
      positivePercent: 100,
      positiveReviews: 2,
      respondedReviews: 1,
      totalReviews: 2,
    },
    reviews: [
      reviewFixture({ patientName: "Marina Souza" }),
      reviewFixture({
        id: "88888888-8888-4888-8888-888888888888",
        patientName: "Beatriz Lima",
        reply: {
          body: "Obrigada pela confiança.",
          id: "99999999-9999-4999-8999-999999999999",
          publishedAt: "2026-07-28T14:30:00.000Z",
          status: "published",
        },
        responseStatus: "responded",
      }),
    ],
    therapist: {
      plan: "premium",
      profileId: "66666666-6666-4666-8666-666666666666",
      publicName: "Ana Oliveira",
      publicSlug: "ana-oliveira",
    },
    ...overrides,
  };
}

function reviewFixture(
  overrides: Partial<TherapistReviewsPageData["reviews"][number]> = {},
): TherapistReviewsPageData["reviews"][number] {
  return {
    comment: "Senti acolhimento durante o encontro online.",
    id: "55555555-5555-4555-8555-555555555555",
    patientInitials: "MS",
    patientName: "Marina Souza",
    publishedAt: "2026-07-28T12:00:00.000Z",
    publishedLabel: "28 de Jul, 2026",
    rating: 5,
    reply: null,
    responseStatus: "pending",
    serviceTitle: "Reiki online",
    therapyName: "Reiki",
    ...overrides,
  };
}
