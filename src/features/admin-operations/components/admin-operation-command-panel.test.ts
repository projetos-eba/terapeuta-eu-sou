import { describe, expect, it } from "vitest";

import { getCommandOptions } from "./admin-operation-command-panel";

describe("admin verification command flow", () => {
  it("starts analysis before exposing decision commands", () => {
    expect(getCommandOptions({ module: "verifications", statusLabel: "submitted" })).toEqual([
      expect.objectContaining({
        action: "verification.reopen_review",
        label: "Iniciar análise",
      }),
    ]);
  });

  it("exposes decisions only while the registration is in analysis", () => {
    expect(
      getCommandOptions({ module: "verifications", statusLabel: "in_review" }).map(
        (option) => option.label,
      ),
    ).toEqual([
      "Aprovar verificação",
      "Solicitar ajustes",
      "Reprovar verificação",
    ]);
  });

  it("does not expose decisions after approval", () => {
    expect(getCommandOptions({ module: "verifications", statusLabel: "approved" })).toEqual([]);
  });

  it("does not expose suspension for a professional awaiting analysis", () => {
    expect(getCommandOptions({ module: "professionals", statusLabel: "submitted" })).toEqual([]);
    expect(getCommandOptions({ module: "professionals", statusLabel: "approved" })).toEqual([
      expect.objectContaining({ action: "professional.suspend" }),
    ]);
  });

  it("exposes publication only for an approved profile that is ready", () => {
    expect(
      getCommandOptions({
        canPublish: true,
        module: "verifications",
        relatedProfessionalId: "profile-1",
        statusLabel: "approved",
      }),
    ).toEqual([
      expect.objectContaining({
        action: "professional.publish",
        entityId: "profile-1",
      }),
    ]);
  });
});
