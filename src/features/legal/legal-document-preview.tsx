import { notFound } from "next/navigation";

import { getLegalDocumentContent } from "@/domain/legal/legal-document-content";
import type { LegalDocument } from "@/domain/legal/legal-registry";
import { isDocumentPublishable } from "@/domain/legal/legal-registry";

export function LegalDocumentPreview({
  document,
}: {
  document: LegalDocument | undefined;
}) {
  if (!document) {
    notFound();
  }

  const isPublishable = isDocumentPublishable(document);

  if (!isPublishable && isProductionRuntime()) {
    notFound();
  }

  if (isPublishable) {
    const content = getLegalDocumentContent(document.documentKey);

    if (!content?.paragraphs.length) {
      notFound();
    }

    return (
      <article className="rounded-card border border-brand-lavender bg-white p-6 text-sm font-semibold leading-7 text-tesText-secondary shadow-card sm:p-8">
        <header className="border-b border-brand-lavender pb-6">
          <h2 className="mt-3 text-2xl font-extrabold text-brand-deep">
            {document.title}
          </h2>
        </header>
        <details
          className="group mt-6 rounded-2xl border border-brand-lavender bg-surface-muted px-4 open:bg-white sm:px-5"
          open
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-extrabold text-brand-deep [&::-webkit-details-marker]:hidden">
            Ler documento completo
            <span aria-hidden="true" className="text-brand-primary">
              +
            </span>
          </summary>
          <div className="space-y-5 border-t border-brand-lavender pb-5 pt-4">
            {content.paragraphs.map((paragraph, index) => (
              <LegalParagraph key={`${document.documentKey}-${index}`}>
                {paragraph}
              </LegalParagraph>
            ))}
          </div>
        </details>
      </article>
    );
  }

  return (
    <article className="rounded-card border border-brand-lavender bg-white p-6 text-sm font-semibold leading-7 text-tesText-secondary shadow-card">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-primary">
        Revisão interna
      </p>
      <h2 className="mt-3 text-xl font-extrabold text-brand-deep">
        {document.title}
      </h2>
      <p className="mt-3">
        Este conteúdo ainda está em revisão e será publicado quando estiver
        pronto para você.
      </p>
    </article>
  );
}

function LegalParagraph({ children }: { children: string }) {
  const isMainTitle =
    children === children.toUpperCase() && children.length < 90;
  const isSectionTitle =
    children.startsWith("CAPÍTULO ") ||
    (/^[0-9]+\.[0-9]+ /.test(children) && children.length < 90);

  if (isMainTitle || isSectionTitle) {
    return (
      <h3 className="pt-3 text-base font-extrabold leading-7 text-brand-deep">
        {children}
      </h3>
    );
  }

  return <p>{children}</p>;
}

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}
