import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicInfoLayout } from "@/features/public-support/public-info-layout";

export const metadata: Metadata = {
  description: "Status operacional da plataforma Terapeuta Eu Sou.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Status da plataforma | Terapeuta Eu Sou",
};

const components = [
  "Site",
  "Autenticação",
  "Pagamentos",
  "Encontros por vídeo",
  "Mensagens e notificações",
];

export default function StatusPage() {
  if (isProductionRuntime()) {
    notFound();
  }

  return (
    <PublicInfoLayout eyebrow="Status" title="Status da plataforma">
      <section className="rounded-card border border-brand-lavender bg-white p-6 shadow-card">
        <p className="text-sm font-semibold leading-7 text-tesText-secondary">
          Esta visualização existe apenas para revisão interna. A publicação
          externa do status fica bloqueada até existir fonte operacional
          auditada para incidentes, manutenção e última atualização.
        </p>
        <div className="mt-6 grid gap-3">
          {components.map((component) => (
            <div
              className="flex items-center justify-between gap-4 rounded-[18px] border border-brand-lavender bg-surface-muted p-4"
              key={component}
            >
              <h2 className="text-base font-extrabold text-brand-deep">
                {component}
              </h2>
              <span className="text-sm font-bold text-tesText-muted">
                Sem fonte publicada
              </span>
            </div>
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
