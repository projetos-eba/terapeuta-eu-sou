import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getLegalDocumentContent } from "@/domain/legal/legal-document-content";
import { getLegalDocument } from "@/domain/legal/legal-registry";

import { LegalDocumentPreview } from "./legal-document-preview";

describe("LegalDocumentPreview", () => {
  it("identifies the published terms version and update date", () => {
    render(
      <LegalDocumentPreview document={getLegalDocument("terms-of-use")} />,
    );

    expect(
      screen.getByText("Versão 3 · Atualizado em 18 de setembro de 2026"),
    ).toBeInTheDocument();
  });

  it("renders the V2 cancellation policy rules", () => {
    const content = getLegalDocumentContent(
      "cancellation-reschedule-refund-policy",
    );

    expect(content?.sourceFile).toBe(
      "Política de Cancelamento, Reagendamento e Reembolso - completo v2 (1).pdf",
    );
    expect(content?.paragraphs).toContain(
      "2.7 Reagendamento solicitado pelo terapeuta",
    );
    expect(content?.paragraphs).toContain("6.8 Vigência");
  });
});
