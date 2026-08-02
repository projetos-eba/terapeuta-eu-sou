import { notFound } from "next/navigation";

import { getLegalDocumentContent } from "@/domain/legal/legal-document-content";
import type { LegalDocument } from "@/domain/legal/legal-registry";
import {
  isDocumentPublishable,
  legalEntity,
} from "@/domain/legal/legal-registry";

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
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-primary">
            Versão {document.version}
          </p>
          <h2 className="mt-3 text-2xl font-extrabold text-brand-deep">
            {document.title}
          </h2>
          <p className="mt-2">
            Vigência: {formatDate(document.effectiveDate)}. Última atualização:{" "}
            {formatDate(document.approvalDate)}.
          </p>
          <dl className="mt-5 grid gap-3 rounded-[18px] bg-surface-muted p-4 sm:grid-cols-2">
            <PreviewDetail
              label="Entidade"
              value={legalEntity.businessName ?? legalEntity.tradeName}
            />
            <PreviewDetail
              label="Caminho canônico"
              value={document.canonicalPath ?? "A definir"}
            />
            <PreviewDetail label="Hash SHA-256" value={document.hash ?? ""} />
            <PreviewDetail label="Fonte" value={document.sourceFile} />
          </dl>
        </header>
        <div className="mt-8 space-y-5">
          {content.paragraphs.map((paragraph, index) => (
            <LegalParagraph key={`${document.documentKey}-${index}`}>
              {paragraph}
            </LegalParagraph>
          ))}
        </div>
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
        Esta visualização existe apenas para ambiente de desenvolvimento e
        revisão. A publicação externa fica bloqueada pelo gate jurídico até a
        versão aprovada estar registrada.
      </p>
      <dl className="mt-6 grid gap-4 rounded-[18px] bg-surface-muted p-4 sm:grid-cols-2">
        <PreviewDetail label="Status" value={document.status} />
        <PreviewDetail label="Fonte" value={document.sourceFile} />
        <PreviewDetail
          label="Entidade"
          value={legalEntity.businessName ?? legalEntity.tradeName}
        />
        <PreviewDetail
          label="Caminho canônico"
          value={document.canonicalPath ?? "A definir"}
        />
      </dl>
    </article>
  );
}

function LegalParagraph({ children }: { children: string }) {
  const isMainTitle = children === children.toUpperCase() && children.length < 90;
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

function PreviewDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-tesText-muted">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-extrabold text-brand-deep">
        {value}
      </dd>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
    new Date(value),
  );
}

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}
