import { describe, expect, it, vi } from "vitest";

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound }));

import AdminIntegrationsRoute from "./page";

describe("AdminIntegrationsRoute", () => {
  it("returns not found before loading any integration surface", () => {
    expect(() => AdminIntegrationsRoute()).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
  });
});
