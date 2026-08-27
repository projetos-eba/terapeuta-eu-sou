import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PatientPublicReviewForm } from "./patient-public-review-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PatientPublicReviewForm", () => {
  it("publishes and later offers hiding the canonical review", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({
        data: { eligible: true, review: null, therapistProfileId: "therapist-1" },
        ok: true,
      }))
      .mockResolvedValueOnce(response({
        data: {
          idempotentReplay: false,
          review: {
            comment: "Acolhimento cuidadoso.",
            createdAt: "2026-08-26T10:00:00.000Z",
            id: "review-1",
            publishedAt: "2026-08-26T10:00:00.000Z",
            rating: 5,
            status: "published",
            updatedAt: "2026-08-26T10:00:00.000Z",
          },
        },
        ok: true,
      }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PatientPublicReviewForm
        therapistName="Ana"
        therapistProfileId="10000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "5 estrelas" }));
    fireEvent.change(screen.getByLabelText(/comentário/i), {
      target: { value: "Acolhimento cuidadoso." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar avaliação" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Avaliação publicada no perfil do terapeuta.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ocultar" })).toBeInTheDocument();
  });

  it("keeps the action blocked before the first qualified encounter", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({
      data: { eligible: false, review: null, therapistProfileId: "therapist-1" },
      ok: true,
    })));
    render(
      <PatientPublicReviewForm
        therapistName="Ana"
        therapistProfileId="10000000-0000-4000-8000-000000000001"
      />,
    );
    expect(await screen.findByText(/será liberada após a confirmação/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /publicar avaliação/i })).not.toBeInTheDocument();
  });
});

function response(payload: unknown) {
  return { json: async () => payload, ok: true, status: 200 };
}
