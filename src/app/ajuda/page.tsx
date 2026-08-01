import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { supportMatrix } from "@/domain/legal/legal-registry";
import { PublicInfoLayout } from "@/features/public-support/public-info-layout";

export const metadata: Metadata = {
  description: "Central pública de ajuda do Terapeuta Eu Sou.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Ajuda | Terapeuta Eu Sou",
};

export default function HelpPage() {
  if (isProductionRuntime()) {
    notFound();
  }

  return (
    <PublicInfoLayout eyebrow="Ajuda" title="Central de ajuda">
      <section className="rounded-card border border-brand-lavender bg-white p-6 shadow-card">
        <p className="text-sm font-semibold leading-7 text-tesText-secondary">
          Esta visualização existe apenas para revisão interna. A central
          pública fica bloqueada até canais, horários e prazos de atendimento
          estarem aprovados no registry jurídico.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {supportMatrix.map((item) => (
            <article
              className="rounded-[18px] border border-brand-lavender bg-surface-muted p-4"
              key={item.categoryKey}
            >
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-primary">
                {item.priority}
              </p>
              <h2 className="mt-2 text-lg font-extrabold text-brand-deep">
                {item.label}
              </h2>
              <p className="mt-2 text-sm font-semibold text-tesText-secondary">
                Status: {item.status}
              </p>
            </article>
          ))}
        </div>
      </section>
    </PublicInfoLayout>
  );
}

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}
