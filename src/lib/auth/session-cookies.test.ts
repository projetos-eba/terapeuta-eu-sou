import { describe, expect, it } from "vitest";

import { createSessionIdentityMarker } from "./session-cookies";

describe("authenticated session identity marker", () => {
  it("stays stable for the same account and changes for another account", () => {
    const first = createSessionIdentityMarker("patient", "user-a");

    expect(createSessionIdentityMarker("patient", "user-a")).toBe(first);
    expect(createSessionIdentityMarker("patient", "user-b")).not.toBe(first);
    expect(createSessionIdentityMarker("therapist", "user-a")).not.toBe(
      first,
    );
    expect(first).not.toContain("user-a");
  });
});
