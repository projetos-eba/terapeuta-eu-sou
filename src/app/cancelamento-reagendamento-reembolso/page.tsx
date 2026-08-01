import type { Metadata } from "next";

import { getLegalDocument } from "@/domain/legal/legal-registry";
import { LegalDocumentPreview } from "@/features/legal/legal-document-preview";
import { PublicInfoLayout } from "@/features/public-support/public-info-layout";

export const metadata: Metadata = {
  description:
    "Política de cancelamento, reagendamento e reembolso do Terapeuta Eu Sou.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Cancelamento e reembolso | Terapeuta Eu Sou",
};

export default function CancellationPolicyPage() {
  return (
    <PublicInfoLayout
      eyebrow="Legal"
      title="Cancelamento, reagendamento e reembolso"
    >
      <LegalDocumentPreview
        document={getLegalDocument("cancellation-reschedule-refund-policy")}
      />
    </PublicInfoLayout>
  );
}
