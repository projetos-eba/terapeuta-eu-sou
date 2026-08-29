import type { StripeClient } from "./stripe-client.ts";

export async function expireOpenCheckoutForAbandonment(input: {
  checkoutSessionId: string;
  stripe: Pick<StripeClient, "checkout">;
}) {
  const checkout = await input.stripe.checkout.sessions.retrieve(
    input.checkoutSessionId,
  );

  if (checkout.status === "expired") return true;
  if (checkout.status !== "open") return false;

  await input.stripe.checkout.sessions.expire(input.checkoutSessionId);
  return true;
}
