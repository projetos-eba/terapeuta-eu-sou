import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, CalendarClock, Heart, Star, Users } from "lucide-react";

import { TESButton } from "@/components/tes";
import { routes } from "@/lib/routes";
import type { RelatedTherapist } from "../../types/therapy-detail";
import { buildTherapistProfileHref } from "./detail-links";

type RelatedTherapistCardProps = {
  source: string;
  therapist: RelatedTherapist;
  therapySlug: string;
};

export function RelatedTherapistCard({
  source,
  therapist,
  therapySlug,
}: RelatedTherapistCardProps) {
  const profileHref = buildTherapistProfileHref({
    source,
    therapistSlug: therapist.slug,
    therapySlug,
  });
  const favoriteHref = `${routes.public.clientSignIn}?returnUrl=${encodeURIComponent(profileHref)}`;

  return (
    <article className="flex h-full flex-col gap-4 border-border bg-white p-4 sm:p-5 lg:border-b lg:border-r">
      <div className="grid gap-4 sm:grid-cols-[1fr_178px]">
        <div className="flex gap-4">
          <div className="relative size-[72px] shrink-0 overflow-hidden rounded-full bg-brand-lavenderSoft sm:size-[78px]">
            {therapist.photoUrl ? (
              <Image
                src={therapist.photoUrl}
                alt=""
                fill
                sizes="78px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-3xl font-serif italic text-brand-primary">
                {therapist.name.slice(0, 1)}
              </div>
            )}
            <span
              className="absolute bottom-2 right-2 size-3 rounded-full border-2 border-white bg-status-success"
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0 pt-1">
            <h3 className="text-xl font-extrabold leading-tight text-brand-primary">
              {therapist.name}
            </h3>
            <p className="mt-1 text-xs font-extrabold text-status-info">
              {therapist.headline}
            </p>
            <p className="mt-2 max-w-[340px] overflow-hidden text-sm font-semibold leading-6 text-tesText-secondary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
              {therapist.serviceDescription}
            </p>
          </div>
        </div>

        <div className="rounded-md bg-surface-soft p-3">
          <p className="text-xs font-extrabold text-brand-primary">
            Temas de atuação
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {therapist.tags.length > 0 ? (
              therapist.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold leading-tight text-tesText-secondary"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-xs font-semibold text-tesText-muted">
                Perfil em atualização
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs font-bold text-tesText-secondary">
        <span className="flex items-center gap-1.5">
          <Star className="h-4 w-4 fill-current text-status-warning" aria-hidden="true" />
          {therapist.averageRating
            ? `${therapist.averageRating.toFixed(1).replace(".", ",")} (${therapist.reviewCount} avaliações)`
            : "Perfil novo"}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          {therapist.completedSessionCount > 0
            ? `${therapist.completedSessionCount} sessões realizadas`
            : "Sessões em breve"}
        </span>
        {therapist.nextSlotAt ? (
          <span className="flex items-center gap-1.5">
            <CalendarClock className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            {formatNextSlot(therapist.nextSlotAt)}
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex items-center gap-3 border-t border-border pt-3">
        <TESButton
          href={profileHref}
          variant="secondary"
          className="min-h-11 flex-1 rounded-md border-brand-lavender text-brand-primary"
        >
          Ver perfil
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </TESButton>
        <Link
          href={favoriteHref as Route<string>}
          aria-label={`Entrar para favoritar ${therapist.name}`}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-brand-primary transition hover:bg-brand-lavenderSoft focus:outline-none focus:ring-4 focus:ring-ring/20"
        >
          <Heart className="h-6 w-6" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function formatNextSlot(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Horários disponíveis";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(date);
}
