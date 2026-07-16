import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Heart, Leaf, Sparkles } from "lucide-react";

import { TESButton, TESCard } from "@/components/tes";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

import type { PublicTherapyListItem } from "../types";

type TherapyCardProps = {
  className?: string;
  therapy: PublicTherapyListItem;
};

export function TherapyCard({ className, therapy }: TherapyCardProps) {
  const detailHref = routes.public.therapyDetail(therapy.slug);
  const favoriteHref = `${routes.public.clientSignIn}?next=${encodeURIComponent(
    routes.public.therapies,
  )}`;

  return (
    <TESCard
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-[28px] border-brand-lavender/80 bg-white p-3 shadow-[0_18px_48px_rgba(38,20,51,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_64px_rgba(38,20,51,0.14)]",
        className,
      )}
    >
      <div className="relative min-h-[188px] overflow-hidden rounded-[24px] bg-brand-lavenderSoft">
        {therapy.imageUrl ? (
          <Image
            src={therapy.imageUrl}
            alt=""
            fill
            sizes="(min-width: 1180px) 240px, (min-width: 768px) 33vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full min-h-[188px] items-center justify-center bg-[radial-gradient(circle_at_50%_35%,#ffffff_0,#f1e8f6_46%,#e2d1ec_100%)]">
            <Leaf className="h-12 w-12 text-brand-primary" aria-hidden="true" />
          </div>
        )}

        <Link
          href={favoriteHref as Route<string>}
          aria-label={`Entrar para favoritar ${therapy.name}`}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/90 text-brand-primary shadow-card transition hover:bg-brand-lavenderSoft focus:outline-none focus:ring-4 focus:ring-ring/20"
        >
          <Heart className="h-4 w-4" aria-hidden="true" />
        </Link>

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {therapy.isPopular ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/92 px-3 py-1 text-[11px] font-extrabold text-brand-primary shadow-card">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Popular
            </span>
          ) : null}
          {therapy.isNew ? (
            <span className="inline-flex rounded-full bg-status-successBg px-3 py-1 text-[11px] font-extrabold text-status-success">
              Nova
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-5">
        <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-primary">
          {therapy.category.name}
        </span>
        <h2 className="mt-2 min-h-[64px] text-[28px] font-semibold leading-[1.05] text-brand-deep">
          {therapy.name}
        </h2>
        <p className="mt-3 min-h-[72px] text-sm font-semibold leading-6 text-text-secondary">
          {therapy.shortDescription}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3 text-sm font-extrabold text-text-muted">
          <span>
            {therapy.therapistCount > 0
              ? `${therapy.therapistCount} profissionais`
              : "Profissionais em breve"}
          </span>
          <ArrowRight
            className="h-4 w-4 text-brand-primary transition group-hover:translate-x-1"
            aria-hidden="true"
          />
        </div>

        <TESButton
          href={detailHref}
          variant="secondary"
          className="mt-5 min-h-12 w-full border-brand-lavender text-brand-primary hover:bg-brand-lavenderSoft"
        >
          Conhecer terapia
        </TESButton>
      </div>
    </TESCard>
  );
}
