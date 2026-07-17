import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, CalendarClock, Check, Heart, Star, Users } from "lucide-react";

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
    <article className="grid gap-5 rounded-[14px] border border-[#e5e0f5] bg-white p-5 lg:grid-cols-[440px_1fr_270px_150px] lg:items-center lg:gap-6">
      <div className="flex gap-5">
        <div className="relative size-[96px] shrink-0 overflow-hidden rounded-full bg-brand-lavenderSoft sm:size-[108px]">
          {therapist.photoUrl ? (
            <Image
              src={therapist.photoUrl}
              alt=""
              fill
              sizes="108px"
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
          <h3 className="text-2xl font-extrabold leading-tight text-[#3d14ad]">
            {therapist.name}
          </h3>
          <p className="mt-2 text-sm font-extrabold text-[#0894ab]">
            {therapist.headline}
          </p>
          <p className="mt-3 max-w-[340px] text-sm font-semibold leading-6 text-[#3b3d80]">
            {therapist.serviceDescription}
          </p>
        </div>
      </div>

      <div className="border-t border-[#e5e0f5] pt-4 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
        <p className="text-sm font-extrabold text-[#3d14ad]">
          Temas de atuação
        </p>
        <ul className="mt-3 space-y-2">
          {therapist.tags.length > 0 ? (
            therapist.tags.map((tag) => (
              <li
                key={tag}
                className="flex items-center gap-2 text-sm font-semibold text-[#3b3d80]"
              >
                <Check className="h-4 w-4 text-status-success" aria-hidden="true" />
                {tag}
              </li>
            ))
          ) : (
            <li className="text-sm font-semibold text-[#6b669e]">
              Perfil em atualização
            </li>
          )}
        </ul>
      </div>

      <div className="border-t border-[#e5e0f5] pt-4 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
        {therapist.averageRating ? (
          <div className="flex items-center gap-1 text-[#ffa80d]">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star
                key={index}
                className="h-5 w-5 fill-current"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : (
          <span className="inline-flex rounded-full bg-[#e0f2ff] px-3 py-1 text-xs font-extrabold text-[#1478e0]">
            Novo
          </span>
        )}

        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#3b3d80]">
          <Star className="h-4 w-4 text-[#8033e0]" aria-hidden="true" />
          {therapist.averageRating
            ? `${therapist.averageRating.toFixed(1).replace(".", ",")} (${therapist.reviewCount} avaliações)`
            : "Perfil novo"}
        </p>
        <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#3b3d80]">
          <Users className="h-4 w-4 text-[#8033e0]" aria-hidden="true" />
          {therapist.completedSessionCount > 0
            ? `${therapist.completedSessionCount} sessões realizadas`
            : "Sessões em breve"}
        </p>
        {therapist.nextSlotAt ? (
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#3b3d80]">
            <CalendarClock className="h-4 w-4 text-[#8033e0]" aria-hidden="true" />
            {formatNextSlot(therapist.nextSlotAt)}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-3 lg:justify-end">
        <TESButton
          href={profileHref}
          variant="secondary"
          className="min-h-12 flex-1 rounded-[8px] border-[#b299e5] text-[#3d14ad] lg:flex-none"
        >
          Ver perfil
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </TESButton>
        <Link
          href={favoriteHref as Route<string>}
          aria-label={`Entrar para favoritar ${therapist.name}`}
          className="flex min-h-12 min-w-12 items-center justify-center rounded-full text-[#3d14ad] transition hover:bg-brand-lavenderSoft focus:outline-none focus:ring-4 focus:ring-ring/20"
        >
          <Heart className="h-7 w-7" aria-hidden="true" />
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
