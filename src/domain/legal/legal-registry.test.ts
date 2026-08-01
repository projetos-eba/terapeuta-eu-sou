import { describe, expect, it } from "vitest";

import {
  getLegalDocument,
  getLegalReadinessIssues,
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

  it("does not treat legal-review documents as publishable", () => {
    expect(isDocumentPublishable(getLegalDocument("terms-of-use"))).toBe(false);
    expect(isDocumentPublishable(getLegalDocument("privacy-policy"))).toBe(
      false,
    );
  });

  it("reports launch blockers while required legal decisions are missing", () => {
    expect(getLegalReadinessIssues()).toEqual(
      expect.arrayContaining([
        "LEGAL_ENTITY_MISSING:businessName",
        "LEGAL_DOCUMENT_NOT_PUBLISHABLE:terms-of-use",
        "LEGAL_DOCUMENT_NOT_PUBLISHABLE:privacy-policy",
        "LEGAL_DOCUMENT_NOT_PUBLISHABLE:cancellation-reschedule-refund-policy",
        "SUPPORT_CATEGORY_NOT_PUBLISHABLE:encounter_urgent",
      ]),
    );
  });
});
