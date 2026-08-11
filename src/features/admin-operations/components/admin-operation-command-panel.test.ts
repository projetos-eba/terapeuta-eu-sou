import { describe, expect, it } from "vitest";

import { getCommandOptions } from "./admin-operation-command-panel";

describe("admin verification command flow", () => {
  it("starts analysis before exposing decision commands", () => {
    expect(getCommandOptions("verifications", "submitted")).toEqual([
      expect.objectContaining({
        action: "verification.reopen_review",
        label: "Iniciar análise",
      }),
    ]);
  });

  it("exposes decisions only while the registration is in analysis", () => {
    expect(
      getCommandOptions("verifications", "in_review").map(
        (option) => option.label,
      ),
    ).toEqual([
      "Aprovar verificação",
      "Solicitar ajustes",
      "Reprovar verificação",
    ]);
  });

  it("does not expose decisions after approval", () => {
    expect(getCommandOptions("verifications", "approved")).toEqual([]);
  });

  it("does not expose suspension for a professional awaiting analysis", () => {
    expect(getCommandOptions("professionals", "submitted")).toEqual([]);
    expect(getCommandOptions("professionals", "approved")).toEqual([
      expect.objectContaining({ action: "professional.suspend" }),
    ]);
  });
});
