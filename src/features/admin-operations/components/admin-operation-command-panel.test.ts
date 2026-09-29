import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { AdminOperationDetailPageData } from "../admin-operations.types";
import {
  AdminOperationCommandPanel,
  getCommandOptions,
} from "./admin-operation-command-panel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

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

  it("keeps approval visible but disabled while the profile is incomplete", () => {
    expect(
      getCommandOptions({
        canApprove: false,
        module: "verifications",
        statusLabel: "in_review",
      }).find((option) => option.action === "verification.approve"),
    ).toEqual(expect.objectContaining({ disabled: true }));
  });

  it("explains why approval is disabled and keeps request changes available", () => {
    const html = renderToStaticMarkup(
      createElement(AdminOperationCommandPanel, {
        data: verificationDetailData({
          approvalGuidance: {
            blockers: ["perfil público ainda não está completo"],
            incompleteProfileItems: ["Foto de perfil"],
          },
          canApprove: false,
        }),
      }),
    );

    expect(html).toContain("A aprovação ainda não está disponível");
    expect(html).toContain("perfil público ainda não está completo");
    expect(html).toContain("Foto de perfil");
    expect(html).toContain("Use entre 8 e 1.000 caracteres.");
    expect(html).toContain("Solicitar ajustes");
    expect(html).toMatch(/Aprovar verificação[^>]*<\/button>|disabled[^>]*>.*Aprovar verificação/s);
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

function verificationDetailData(
  overrides: Partial<AdminOperationDetailPageData> = {},
): AdminOperationDetailPageData {
  return {
    auditEvents: [],
    backHref: "/admin/profissionais/verificacoes",
    generatedAt: "2026-09-29T10:00:00.000Z",
    id: "verification-1",
    module: "verifications",
    safetyNotes: [],
    sections: [],
    statusLabel: "in_review",
    subtitle: "",
    title: "Terapeuta",
    ...overrides,
  };
}
