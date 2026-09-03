"use client";

import Link from "next/link";
import type { Route } from "next";
import { AlertCircle, Clock3 } from "lucide-react";
import { useState } from "react";

import { TESDialog } from "@/components/tes";

import type { TherapistDashboardPageData } from "../therapist-dashboard.types";

const PREVIEW_ITEM_LIMIT = 3;

export function TherapistAttentionSection({
  items,
}: {
  items: TherapistDashboardPageData["attentionItems"];
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const hasMoreItems = items.length > PREVIEW_ITEM_LIMIT;
  const visibleItems = hasMoreItems
    ? items.slice(0, PREVIEW_ITEM_LIMIT)
    : items;

  return (
    <section className="rounded-panel border border-[var(--tes-color-border)]/70 bg-white p-5 shadow-card sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-brand-deep">
          O que merece sua atenção hoje
        </h2>
        {hasMoreItems ? (
          <button
            className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold text-brand-deep outline-none transition hover:text-brand-primary focus-visible:ring-4 focus-visible:ring-ring/20"
            onClick={() => setIsDialogOpen(true)}
            type="button"
          >
            Ver todos os itens →
          </button>
        ) : null}
      </div>
      {items.length ? (
        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((item) => (
            <AttentionItemLink item={item} key={item.id} />
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-tesText-secondary">
          Nenhum item precisa da sua atenção agora.
        </p>
      )}

      {isDialogOpen ? (
        <TESDialog
          description="Acesse cada item pelo destino correspondente para continuar sua rotina."
          onClose={() => setIsDialogOpen(false)}
          title="Todos os itens de atenção"
        >
          <div className="grid gap-3">
            {items.map((item) => (
              <AttentionItemLink item={item} key={item.id} />
            ))}
          </div>
        </TESDialog>
      ) : null}
    </section>
  );
}

function AttentionItemLink({
  item,
}: {
  item: TherapistDashboardPageData["attentionItems"][number];
}) {
  const Icon = item.tone === "warning" ? AlertCircle : Clock3;
  const iconClasses =
    item.tone === "warning"
      ? "bg-status-warningBg text-status-warning"
      : "bg-brand-lavenderSoft text-brand-primary";

  return (
    <Link
      className="flex min-h-20 items-center gap-4 rounded-md border border-[var(--tes-color-border)] px-4 outline-none transition hover:bg-surface-soft focus-visible:ring-4 focus-visible:ring-ring/20"
      href={item.href as Route<string>}
    >
      <span
        className={`grid size-12 shrink-0 place-items-center rounded-md ${iconClasses}`}
      >
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
}
