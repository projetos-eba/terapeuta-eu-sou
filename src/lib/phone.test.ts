import { describe, expect, it } from "vitest";

import { formatPhoneNumber, toE164, validatePhoneNumber } from "./phone";

describe("phone contract", () => {
  it("formats Brazilian numbers as they are typed", () => {
    expect(formatPhoneNumber("19326864625", "55")).toBe("(19) 32686-4625");
    expect(validatePhoneNumber("55", "(19) 32686-4625", true)).toBeNull();
  });

  it("rejects incomplete or repeated numbers", () => {
    expect(validatePhoneNumber("55", "119999", true)).toBeTruthy();
    expect(validatePhoneNumber("55", "11111111111", true)).toBeTruthy();
  });

  it("composes the integration value without changing stored national digits", () => {
    expect(toE164("55", "(19) 32686-4625")).toBe("+5519326864625");
  });
});
