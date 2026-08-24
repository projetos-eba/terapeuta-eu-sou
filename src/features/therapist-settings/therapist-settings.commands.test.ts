import { afterEach, describe, expect, it, vi } from "vitest";

import { lookupTherapistAddressByCep } from "./therapist-settings.commands";

describe("therapist address lookup command", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps a ViaCEP response to editable address fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              city: "São Paulo",
              neighborhood: "Morumbi",
              postalCode: "13060-240",
              state: "SP",
              street: "Rua de teste",
            },
            ok: true,
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(lookupTherapistAddressByCep("13060-240")).resolves.toEqual({
      data: {
        city: "São Paulo",
        neighborhood: "Morumbi",
        postalCode: "13060-240",
        state: "SP",
        street: "Rua de teste",
      },
      status: "success",
    });
  });

  it("returns a manual-entry fallback when the provider is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: "CEP não encontrado." },
            ok: false,
          }),
          { status: 404 },
        ),
      ),
    );

    const result = await lookupTherapistAddressByCep("00000-000");

    expect(result).toMatchObject({
      error: { message: "CEP não encontrado." },
      status: "error",
    });
  });
});
