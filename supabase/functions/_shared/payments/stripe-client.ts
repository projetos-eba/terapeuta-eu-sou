import Stripe from "stripe";

export const TES_STRIPE_API_VERSION = "2026-06-24.dahlia";

export function createStripeClient(apiKey: string) {
  return new Stripe(apiKey, {
    apiVersion: TES_STRIPE_API_VERSION as never,
    typescript: true,
  });
}

export type StripeClient = ReturnType<typeof createStripeClient>;
