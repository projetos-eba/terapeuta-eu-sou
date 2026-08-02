import { describe, expect, it } from "vitest";

import {
  getLegalDocument,
  getLegalReadinessIssues,
  isSupportMatrixPublishable,
  isDocumentPublishable,
  legalDocuments,
} from "./legal-registry";

describe("legal registry", () => {
  it("tracks the mandatory legal documents", () => {
    expect(legalDocuments.map((document) => document.documentKey)).toEqual([
      "terms-of-use",
      "privacy-policy",
      "cancellation-reschedule-refund-policy",
    ]);
  });

  it("treats published documents with version metadata as publishable", () => {
    expect(isDocumentPublishable(getLegalDocument("terms-of-use"))).toBe(true);
    expect(isDocumentPublishable(getLegalDocument("privacy-policy"))).toBe(
      true,
    );
    expect(
      isDocumentPublishable(
        getLegalDocument("cancellation-reschedule-refund-policy"),
      ),
    ).toBe(true);
  });

  it("treats the reconciled support matrix as publishable", () => {
    expect(isSupportMatrixPublishable()).toBe(true);
  });

  it("keeps launch blockers for missing legal entity decisions", () => {
    expect(getLegalReadinessIssues()).toEqual(
      expect.arrayContaining([
        "LEGAL_ENTITY_MISSING:businessName",
        "LEGAL_ENTITY_MISSING:cnpj",
        "LEGAL_ENTITY_MISSING:address",
      ]),
    );
    expect(getLegalReadinessIssues()).not.toEqual(
      expect.arrayContaining([
        "LEGAL_DOCUMENT_NOT_PUBLISHABLE:terms-of-use",
        "LEGAL_DOCUMENT_NOT_PUBLISHABLE:privacy-policy",
        "LEGAL_DOCUMENT_NOT_PUBLISHABLE:cancellation-reschedule-refund-policy",
        "SUPPORT_CATEGORY_NOT_PUBLISHABLE:encounter_urgent",
      ]),
    );
  });
});
