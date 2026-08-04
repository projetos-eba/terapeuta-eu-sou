import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, GitBranch, Layers3 } from "lucide-react";

import { getAdminTherapyCatalogPage } from "@/features/admin-therapy-catalog/admin-therapy-catalog.queries";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { routes } from "@/lib/routes";

export default async function AdminHomePage() {
  const session = await requireAdminSession();
  const result = await getAdminTherapyCatalogPage({
    accessToken: session.accessToken,
  });

  if (result.status === "error") {
    return (
      <section className="mx-auto max-w-3xl rounded-2xl border border-brand-lavender bg-white p-6 shadow-card">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-brand-primary">
          Administração
        </p>
        <h1 className="mt-3 font-display text-4xl font-light italic text-brand-deep">
          Visão geral
        </h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-tesText-secondary">
          {result.message}
        </p>
      </section>
    );
  }

  const catalog = result.catalog;
  const publishedCount = catalog.items.filter(
    (therapy) => therapy.status === "published" && therapy.isPubliclyVisible,
  ).length;
  const draftCount = catalog.items.filter(
    (therapy) => therapy.status === "draft" || therapy.status === "in_review",
  ).length;
  const matchingVisibleCount = catalog.items.filter(
    (therapy) => therapy.isVisibleInMatching,
  ).length;
  const integrityAlerts = catalog.items.filter(
    (therapy) =>
      therapy.isVisibleInMatching && therapy.matchingThemeIds.length === 0,
  );

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <section className="rounded-2xl border border-brand-lavender bg-white p-5 shadow-card sm:p-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-brand-primary">
          Administração
        </p>
        <h1 className="mt-3 font-display text-4xl font-light italic leading-tight text-brand-deep sm:text-5xl">
          Visão geral
        </h1>
        <p className="mt-3 max-w-3xl text-base font-semibold leading-7 text-tesText-secondary">
          Acompanhe a saúde operacional do catálogo, do Match e das solicitações
          de novas terapias sem expor dados pessoais.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Terapias publicadas" value={publishedCount} />
        <MetricCard label="Rascunhos e revisão" value={draftCount} />
        <MetricCard label="Visíveis no Match" value={matchingVisibleCount} />
        <MetricCard label="Solicitações pendentes" value={catalog.requests.length} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-brand-lavender bg-white p-5 shadow-card">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-lavenderSoft text-brand-primary">
              <AlertTriangle aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-brand-deep">
                Alertas de integridade do Match
              </h2>
              <p className="text-sm font-semibold text-tesText-secondary">
                Terapias no Match precisam de pelo menos um tema canônico.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {integrityAlerts.length === 0 ? (
              <p className="rounded-xl bg-status-successBg p-4 text-sm font-bold text-status-success">
                Nenhum alerta crítico identificado no catálogo analisado.
              </p>
            ) : (
              integrityAlerts.slice(0, 8).map((therapy) => (
                <div
                  className="rounded-xl border border-status-warning/30 bg-status-warningBg p-4"
                  key={therapy.id}
                >
                  <p className="text-sm font-extrabold text-brand-deep">
                    {therapy.name}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-tesText-secondary">
                    Visível no Match sem tema vinculado. Revise antes de
                    publicar ou manter em destaque.
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <QuickLink
            description="Criar, editar, publicar e vincular temas canônicos."
            href={routes.admin.therapies}
            icon={<Layers3 aria-hidden="true" className="size-5" />}
            label="Terapias"
          />
          <QuickLink
            description="Governar temas e refinamentos do Match."
            href="/admin/matching"
            icon={<GitBranch aria-hidden="true" className="size-5" />}
            label="Match"
          />
        </aside>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-brand-lavender bg-white p-5 shadow-card">
      <p className="text-sm font-bold text-tesText-secondary">{label}</p>
      <strong className="mt-2 block text-4xl font-extrabold text-brand-deep">
        {value}
      </strong>
    </div>
  );
}

function QuickLink({
  description,
  href,
  icon,
  label,
}: {
  description: string;
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      className="flex items-start gap-3 rounded-2xl border border-brand-lavender bg-white p-5 shadow-card transition hover:border-brand-primary focus:outline-none focus:ring-4 focus:ring-ring/20"
      href={href}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-lavenderSoft text-brand-primary">
        {icon}
      </span>
      <span>
        <span className="flex items-center gap-2 text-lg font-extrabold text-brand-deep">
          {label}
          <ArrowRight aria-hidden="true" className="size-4" />
        </span>
        <span className="mt-1 block text-sm font-semibold leading-6 text-tesText-secondary">
          {description}
        </span>
      </span>
    </Link>
  );
}
