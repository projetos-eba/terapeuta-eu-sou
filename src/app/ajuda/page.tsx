import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  isSupportMatrixPublishable,
  supportMatrix,
} from "@/domain/legal/legal-registry";
import { PublicInfoLayout } from "@/features/public-support/public-info-layout";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  description: "Central pública de ajuda do Terapeuta Eu Sou.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Ajuda | Terapeuta Eu Sou",
};

export default function HelpPage() {
  if (!isSupportMatrixPublishable()) {
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
        </section>
      </PublicInfoLayout>
    );
  }

  return (
    <PublicInfoLayout eyebrow="Ajuda" title="Central de ajuda">
      <section className="rounded-card border border-brand-lavender bg-white p-6 shadow-card sm:p-8">
        <div className="grid gap-5 md:grid-cols-[1fr_280px]">
          <div>
            <h2 className="text-xl font-extrabold text-brand-deep">
              Canais oficiais de suporte
            </h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-tesText-secondary">
              O atendimento é registrado pelos canais autenticados da plataforma.
              Entre na sua conta de cliente ou terapeuta para abrir um chamado
              com protocolo.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
            <Link
              className="rounded-full bg-brand-primary px-5 py-3 text-center text-sm font-extrabold text-white transition hover:bg-brand-deep"
              href={routes.public.clientSignIn as Route}
            >
              Entrar como cliente
            </Link>
            <Link
              className="rounded-full border border-brand-primary px-5 py-3 text-center text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft"
              href={routes.public.therapistSignIn as Route}
            >
              Entrar como terapeuta
            </Link>
          </div>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
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
              <dl className="mt-4 grid gap-3 text-sm font-semibold leading-6 text-tesText-secondary">
                <SupportDetail label="Canal" value={item.channel} />
                <SupportDetail
                  label="Recebimento"
                  value={item.supportHours}
                />
                <SupportDetail
                  label="Protocolo"
                  value={item.acknowledgement}
                />
                <SupportDetail
                  label="Triagem"
                  value={item.firstResponseTarget}
                />
                <SupportDetail
                  label="Tratativa"
                  value={item.resolutionTarget}
                />
              </dl>
            </article>
          ))}
        </div>
      </section>
    </PublicInfoLayout>
  );
}

function SupportDetail({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <dt className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-tesText-muted">
        {label}
      </dt>
      <dd className="mt-1 text-brand-deep">{value}</dd>
    </div>
  );
}

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

