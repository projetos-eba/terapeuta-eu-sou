import { DomainError } from "../_shared/payments/http.ts";

export function resolveCheckoutReturnUrlBase(input: {
  configuredSiteUrl: string;
  requestedReturnUrlBase?: string | null;
  stripeMode: string;
}) {
  if (!input.requestedReturnUrlBase) return input.configuredSiteUrl;

  let requested: URL;
  try {
    requested = new URL(input.requestedReturnUrlBase);
  } catch {
    throw invalidReturnOrigin();
  }

  const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(
    requested.hostname,
  );
  if (
    input.stripeMode !== "test" ||
    requested.protocol !== "http:" ||
    !isLoopback ||
    requested.username ||
    requested.password ||
    requested.pathname !== "/" ||
    requested.search ||
    requested.hash
  ) {
    throw invalidReturnOrigin();
  }

  return requested.origin;
}

function invalidReturnOrigin() {
  return new DomainError(
    "invalid_checkout_return_origin",
    422,
    "Origem de retorno do checkout invalida.",
  );
}
