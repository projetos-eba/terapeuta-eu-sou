import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Heart, Star } from "lucide-react";

import type { PatientFavoriteProfessional } from "./patient-overview.types";

export function PatientFavoriteTherapistCard({
  professional,
}: {
  professional: PatientFavoriteProfessional;
}) {
  const presentation = professional.summary ?? professional.specialty;

  return (
    <article className="overflow-hidden rounded-md border border-[var(--tes-color-border)] bg-white">
      <div className="relative aspect-[1.25] bg-brand-lavenderSoft">
        {professional.avatarUrl ? (
          <Image
            alt=""
            className="object-cover object-top"
            fill
            sizes="(max-width: 640px) 50vw, 132px"
            src={professional.avatarUrl}
          />
        ) : null}
        <Heart
          aria-label={`${professional.name} está nos favoritos`}
          className="absolute right-2 top-2 size-5 fill-white text-[var(--tes-color-primary-dark)]"
          strokeWidth={1.8}
        />
      </div>
      <div className="flex h-full flex-col p-3">
        <h3 className="truncate text-xs font-semibold text-[var(--tes-color-primary-dark)]">
          {professional.name}
        </h3>
        <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-tesText-secondary">
          <Star
            aria-hidden="true"
            className="size-3 fill-status-warning text-status-warning"
          />
          {professional.averageRating !== null
            ? `${professional.averageRating.toFixed(1)} · ${professional.reviewCount} avaliações`
            : "Ainda sem avaliações"}
        </div>
        {professional.techniques.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {professional.techniques.slice(0, 2).map((technique) => (
              <span
                className="rounded-full bg-brand-lavenderSoft px-2 py-1 text-[9px] font-semibold text-brand-primary"
                key={technique}
              >
                {technique}
              </span>
            ))}
          </div>
        ) : null}
        {presentation ? (
          <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-tesText-secondary">
            {presentation}
          </p>
        ) : null}
        <Link
          className="mt-3 flex min-h-7 items-center justify-center gap-1 rounded-sm border border-[var(--tes-color-border)] text-[10px] font-medium text-brand-primary outline-none transition hover:bg-surface-soft focus-visible:ring-4 focus-visible:ring-ring/20"
          href={professional.profileHref as Route<string>}
        >
          Ver perfil <ArrowRight aria-hidden="true" className="size-3" />
        </Link>
      </div>
    </article>
  );
}
