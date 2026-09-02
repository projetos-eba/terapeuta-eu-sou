import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { DomainError } from "../_shared/payments/http.ts";
import { resolveCheckoutReturnUrlBase } from "./checkout-return-url.ts";

Deno.test("checkout return URL keeps the configured site by default", () => {
  assertEquals(
    resolveCheckoutReturnUrlBase({
      configuredSiteUrl: "https://hml.terapeutaeusou.com.br",
      stripeMode: "test",
    }),
    "https://hml.terapeutaeusou.com.br",
  );
});

Deno.test(
  "checkout return URL allows an explicit loopback origin in test mode",
  () => {
    assertEquals(
      resolveCheckoutReturnUrlBase({
        configuredSiteUrl: "https://hml.terapeutaeusou.com.br",
        requestedReturnUrlBase: "http://localhost:3001",
        stripeMode: "test",
      }),
      "http://localhost:3001",
    );
  },
);

Deno.test("checkout return URL rejects external and live overrides", () => {
  for (const input of [
    { requestedReturnUrlBase: "https://example.com", stripeMode: "test" },
    { requestedReturnUrlBase: "http://localhost:3001", stripeMode: "live" },
    {
      requestedReturnUrlBase: "http://localhost:3001/untrusted",
      stripeMode: "test",
    },
  ]) {
    const error = assertThrows(
      () =>
        resolveCheckoutReturnUrlBase({
          configuredSiteUrl: "https://terapeutaeusou.com.br",
          ...input,
        }),
      DomainError,
    );
    assertEquals(error.code, "invalid_checkout_return_origin");
    assertEquals(error.status, 422);
  }
});
