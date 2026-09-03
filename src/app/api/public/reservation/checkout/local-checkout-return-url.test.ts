import { describe, expect, it } from "vitest";
import { getLocalCheckoutReturnUrlBase } from "./local-checkout-return-url";

describe("local checkout return origin", () => {
  it("preserves the browser loopback host after Next normalizes the URL", () => {
    expect(
      getLocalCheckoutReturnUrlBase(
        new Request("http://localhost:3000/api/public/reservation/checkout", {
          headers: { origin: "http://127.0.0.1:3000" },
        }),
      ),
    ).toBe("http://127.0.0.1:3000");
  });
  it.each([
    null,
    "https://external.example",
    "http://localhost:4000",
    "http://user:password@localhost:3000",
    "http://localhost:3000/path",
    "null",
  ])("does not trust an incompatible origin %s", (origin) => {
    expect(
      getLocalCheckoutReturnUrlBase(
        new Request("http://localhost:3000/api/public/reservation/checkout", {
          headers: origin ? { origin } : undefined,
        }),
      ),
    ).toBe("http://localhost:3000");
  });
  it("never overrides a deployed request origin", () => {
    expect(
      getLocalCheckoutReturnUrlBase(
        new Request(
          "https://hml.terapeutaeusou.com.br/api/public/reservation/checkout",
          {
            headers: { origin: "http://127.0.0.1:3000" },
          },
        ),
      ),
    ).toBeNull();
  });
});
