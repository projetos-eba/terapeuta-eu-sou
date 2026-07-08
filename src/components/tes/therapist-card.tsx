import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { CalendarDays, Heart, Leaf, Sparkles, Star, Video } from "lucide-react";

import { routes } from "@/lib/routes";

import { TESBadge } from "./tes-badge";
import { TESCard } from "./tes-card";

export type TherapistCardData = {
  description: string;
  highlight: string;
  highlightTone: "featured" | "verified";
  image: string;
  name: string;
  nextSlot: string;
  price: string;
  quote: string;
  rating: string;
  reviews: string;
  slug: string;
  specialty: string;
  tags: string[];
};

function Rating({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-1 text-sm font-extrabold text-brand-deep">
      <span>{value}</span>
      <span
        className="flex text-[#F4B84A]"
        aria-label={`${value} de 5 estrelas`}
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <Star key={index} className="size-4 fill-current" />
        ))}
      </span>
    </div>
  );
}

export function TherapistCard({ therapist }: { therapist: TherapistCardData }) {
  const isVerified = therapist.highlightTone === "verified";

  return (
    <TESCard className="grid gap-5 p-3 transition hover:-translate-y-1 hover:shadow-soft sm:grid-cols-[176px_1fr]">
      <div className="relative min-h-[220px] overflow-hidden rounded-[16px] bg-surface-soft sm:min-h-full">
        <Image
          src={therapist.image}
          alt={`Retrato de ${therapist.name}`}
          fill
          sizes="(min-width: 1024px) 176px, 100vw"
          className="object-cover"
        />
      </div>

      <div className="grid min-w-0 gap-4 p-1 sm:grid-cols-[1fr_150px]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <TESBadge tone={isVerified ? "success" : "brand"}>
              {isVerified ? (
                <Leaf className="size-3" />
              ) : (
                <Sparkles className="size-3" />
              )}
              {therapist.highlight}
            </TESBadge>
            <TESBadge tone="soft">
              <Video className="size-3" />
              Vídeo de apresentação
            </TESBadge>
          </div>

          <div className="flex items-start gap-2">
            <h2 className="text-2xl font-extrabold tracking-normal text-brand-deep">
              {therapist.name}
            </h2>
            <button
              aria-label={`Favoritar ${therapist.name}`}
              className="mt-1 text-brand-primary"
            >
              <Heart className="size-5" />
            </button>
          </div>
          <p className="mt-1 text-sm font-extrabold text-brand-primary">
            {therapist.specialty}
          </p>
          <p className="mt-4 text-sm font-semibold leading-6 text-tesText-secondary">
            {therapist.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {therapist.tags.map((tag) => (
              <TESBadge
                key={tag}
                tone="soft"
                className="text-tesText-secondary"
              >
                {tag}
              </TESBadge>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-5 sm:items-end">
          <div className="space-y-2 sm:text-right">
            <Rating value={therapist.rating} />
            <p className="text-xs font-bold text-tesText-muted">
              {therapist.reviews}
            </p>
            <p className="mt-4 text-sm font-bold leading-6 text-brand-primary">
              &quot;{therapist.quote}&quot;
            </p>
          </div>

          <div className="w-full space-y-3">
            <div>
              <p className="flex items-center gap-1 text-xs font-bold text-tesText-muted">
                <CalendarDays className="size-3" />
                Próximo horário
              </p>
              <p className="mt-1 text-lg font-extrabold text-brand-primary">
                {therapist.nextSlot}
              </p>
            </div>
            <p className="text-lg font-extrabold text-brand-primary">
              {therapist.price}
            </p>
            <Link
              href={routes.public.therapistProfile(therapist.slug) as Route}
              className="block rounded-xl bg-brand-primary px-4 py-3 text-center text-sm font-extrabold text-white transition hover:bg-brand-primaryHover"
            >
              Conhecer terapeuta
            </Link>
            <Link
              href={routes.public.reservation as Route}
              className="block rounded-xl border border-border bg-white px-4 py-3 text-center text-sm font-extrabold text-brand-primary transition hover:border-brand-lavender"
            >
              Agendar sessão
            </Link>
          </div>
        </div>
      </div>
    </TESCard>
  );
}
