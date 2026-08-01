import type { Metadata } from "next";

import { getLegalDocument } from "@/domain/legal/legal-registry";
import { LegalDocumentPreview } from "@/features/legal/legal-document-preview";
import { PublicInfoLayout } from "@/features/public-support/public-info-layout";

export const metadata: Metadata = {
  description: "Termos públicos do Terapeuta Eu Sou.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Termos de uso | Terapeuta Eu Sou",
};

export default function TermsPage() {
  return (
    <PublicInfoLayout eyebrow="Legal" title="Termos de uso">
      <LegalDocumentPreview document={getLegalDocument("terms-of-use")} />
    </PublicInfoLayout>
  );
}
