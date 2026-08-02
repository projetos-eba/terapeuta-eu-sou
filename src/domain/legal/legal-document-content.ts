import content from "./legal-document-content.json";

import type { LegalDocumentKey } from "./legal-registry";

type LegalDocumentContentEntry = {
  paragraphs: string[];
  sourceFile: string;
};

type LegalDocumentContentRegistry = {
  documents: Partial<Record<LegalDocumentKey, LegalDocumentContentEntry>>;
  generatedAt: string;
};

const legalDocumentContent = content as LegalDocumentContentRegistry;

export function getLegalDocumentContent(documentKey: LegalDocumentKey) {
  return legalDocumentContent.documents[documentKey];
}

