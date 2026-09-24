import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionObservationCard } from "./session-observation-card";

const bookingId = "96000000-0000-4000-8000-000000000001";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SessionObservationCard", () => {
  it("lets an eligible Premium Plus therapist save one observation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        data: { canEdit: true, observation: null },
        ok: true,
      }))
      .mockResolvedValueOnce(jsonResponse({
        data: {
          observation: {
            bookingId,
            content: "Retomar a conversa na próxima sessão.",
            createdAt: "2026-09-24T15:00:00.000Z",
            updatedAt: "2026-09-24T15:00:00.000Z",
          },
        },
        ok: true,
      }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SessionObservationCard
        bookingId={bookingId}
        initialAccess={{ canEdit: true, observation: null }}
      />,
    );

    const field = await screen.findByLabelText("Suas observações");
    fireEvent.change(field, {
      target: { value: "Retomar a conversa na próxima sessão." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar observações" }));

    await waitFor(() => {
      expect(screen.getByText("Salvo")).toBeInTheDocument();
    });
    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("shows an existing observation as read-only after downgrade", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({
        data: {
          canEdit: false,
          observation: {
            bookingId,
            content: "Registro já salvo.",
            createdAt: "2026-09-24T15:00:00.000Z",
            updatedAt: "2026-09-24T15:00:00.000Z",
          },
        },
        ok: true,
      })),
    );

    render(
      <SessionObservationCard
        bookingId={bookingId}
        initialAccess={{
          canEdit: false,
          observation: {
            bookingId,
            content: "Registro já salvo.",
            createdAt: "2026-09-24T15:00:00.000Z",
            updatedAt: "2026-09-24T15:00:00.000Z",
          },
        }}
      />,
    );

    expect(await screen.findByText("Registro já salvo.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Suas observações")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /salvar/i })).not.toBeInTheDocument();
  });

  it("keeps the typed text after a save failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({
          data: { canEdit: true, observation: null },
          ok: true,
        }))
        .mockResolvedValueOnce(jsonResponse({
          error: { message: "Não foi possível salvar agora." },
          ok: false,
        }, 503)),
    );

    render(
      <SessionObservationCard
        bookingId={bookingId}
        initialAccess={{ canEdit: true, observation: null }}
      />,
    );

    const field = await screen.findByLabelText("Suas observações");
    fireEvent.change(field, { target: { value: "Texto preservado." } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar observações" }));

    expect(await screen.findByText("Não foi possível salvar agora.")).toBeInTheDocument();
    expect(field).toHaveValue("Texto preservado.");
  });
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
