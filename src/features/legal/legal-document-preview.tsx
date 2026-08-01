import { notFound } from "next/navigation";

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
  if (!document || isProductionRuntime()) {
    notFound();
  }

  if (isDocumentPublishable(document)) {
    return (
      <article className="rounded-card border border-brand-lavender bg-white p-6 text-sm font-semibold leading-7 text-tesText-secondary shadow-card">
        <header>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-primary">
            Versão {document.version}
          </p>
          <h2 className="mt-3 text-xl font-extrabold text-brand-deep">
            {document.title}
          </h2>
          <p className="mt-2">
            Vigência: {formatDate(document.effectiveDate)}. Última atualização:{" "}
            {formatDate(document.approvalDate)}.
          </p>
        </header>
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
