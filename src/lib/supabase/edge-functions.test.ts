import { describe, expect, it, vi } from "vitest";

import {
  invokeSupabaseFunction,
  SupabaseFunctionError,
} from "./edge-functions";

describe("invokeSupabaseFunction", () => {
  it("preserves sanitized Edge Function error details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: "stripe_price_missing",
              message: "Catalogo Stripe ainda nao sincronizado.",
              requestId: "request-123",
            },
          }),
          { status: 409 },
        );
      }),
    );

    await expect(
      invokeSupabaseFunction(
        { apiKey: "publishable", url: "http://127.0.0.1:54321" },
        "stripe-create-subscription-checkout",
        { body: { plan: "premium_plus" } },
      ),
    ).rejects.toMatchObject({
      code: "stripe_price_missing",
      functionName: "stripe-create-subscription-checkout",
      message: "Catalogo Stripe ainda nao sincronizado.",
      requestId: "request-123",
      status: 409,
    } satisfies Partial<SupabaseFunctionError>);
  });
});
