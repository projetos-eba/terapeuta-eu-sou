import Link from "next/link";
import type { Route } from "next";
import { AlertCircle, Clock3 } from "lucide-react";

import { routes } from "@/lib/routes";

import type { TherapistDashboardPageData } from "../therapist-dashboard.types";

export function TherapistAttentionSection({
  items,
}: {
  items: TherapistDashboardPageData["attentionItems"];
}) {
  return (
    <section className="rounded-panel border border-[var(--tes-color-border)]/70 bg-white p-5 shadow-card sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-brand-deep">
          O que merece sua atenção hoje
        </h2>
        <Link
          className="text-xs font-bold text-brand-deep outline-none hover:text-brand-primary focus-visible:ring-4 focus-visible:ring-ring/20"
          href={routes.therapist.plusSessions}
        >
          Ver todos os itens →
        </Link>
      </div>
      {items.length ? (
        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const Icon = item.tone === "warning" ? AlertCircle : Clock3;
            return (
              <Link
                className="flex min-h-20 items-center gap-4 rounded-md border border-[var(--tes-color-border)] px-4 outline-none transition hover:bg-surface-soft focus-visible:ring-4 focus-visible:ring-ring/20"
                href={item.href as Route<string>}
                key={item.id}
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-md bg-status-dangerBg text-status-danger">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                {typeof item.count === "number" ? (
                  <strong className="text-2xl font-extrabold text-brand-deep">
                    {item.count}
                  </strong>
                ) : null}
                <span className="text-sm font-bold leading-5 text-brand-deep">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="mt-6 text-sm text-tesText-secondary">
          Nenhum item precisa da sua atenção agora.
        </p>
      )}
    </section>
  );
}
