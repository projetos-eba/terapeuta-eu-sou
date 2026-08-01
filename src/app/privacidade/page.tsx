import type { Metadata } from "next";

import { getLegalDocument } from "@/domain/legal/legal-registry";
import { LegalDocumentPreview } from "@/features/legal/legal-document-preview";
import { PublicInfoLayout } from "@/features/public-support/public-info-layout";

export const metadata: Metadata = {
  description: "Política pública de privacidade do Terapeuta Eu Sou.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Privacidade | Terapeuta Eu Sou",
};

export default function PrivacyPage() {
  return (
    <PublicInfoLayout eyebrow="Privacidade" title="Como tratamos seus dados">
      <LegalDocumentPreview document={getLegalDocument("privacy-policy")} />
    </PublicInfoLayout>
  );
}
