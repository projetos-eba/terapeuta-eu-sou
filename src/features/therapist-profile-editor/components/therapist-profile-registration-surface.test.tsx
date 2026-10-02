import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { TherapistProfileEditorData } from "../therapist-profile-editor.types";
import { TherapistProfileRegistrationSurface } from "./therapist-profile-registration-surface";

describe("TherapistProfileRegistrationSurface", () => {
  it("does not present an in-review profile as complete before canonical completeness reaches 100 percent", () => {
    const html = renderToStaticMarkup(
      <TherapistProfileRegistrationSurface editor={incompleteEditor()} />,
    );

    expect(html).toContain("Complete seu perfil público");
    expect(html).toContain("Ainda falta completar: Foto de perfil e Minha essência.");
    expect(html).toContain(
      "Complete os itens indicados em Perfil profissional para a análise continuar.",
    );
    expect(html).not.toContain("Nenhuma ação adicional é necessária neste momento.");
  });
});

function incompleteEditor() {
  return {
    completeness: {
      items: [
        { complete: false, key: "photo", label: "Foto de perfil" },
        { complete: false, key: "essence", label: "Minha essência" },
      ],
      percent: 67,
      score: 4,
      total: 6,
    },
    derived: {
      activeServiceCount: 1,
      availabilityRuleCount: 1,
      verificationStatus: "in_review",
    },
    privateDocuments: [
      { kind: "identity_document", status: "uploaded" },
      { kind: "address_proof", status: "uploaded" },
    ],
    published: {
      fields: {
        city: "São Paulo",
        publicName: "Terapeuta de teste",
        state: "SP",
      },
    },
    verificationSummary: null,
  } as TherapistProfileEditorData;
}
