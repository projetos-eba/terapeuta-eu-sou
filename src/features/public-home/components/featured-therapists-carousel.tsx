"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, ArrowRight, Star } from "lucide-react";
import { useRef } from "react";

import { TESButton, TESCard } from "@/components/tes";
import type { PublicHomeTherapist } from "@/features/public-home";
import { routes } from "@/lib/routes";

function getTherapistTags(therapist: PublicHomeTherapist) {
  return therapist.guideItems?.slice(0, 6) ?? [];
}

function formatTherapies(therapyNames: string[] | undefined) {
  if (!therapyNames?.length) {
    return "Terapias publicadas no perfil";
  }

  const visibleTherapies = therapyNames.slice(0, 2);
  const remainingCount = therapyNames.length - visibleTherapies.length;
  const baseText = visibleTherapies.join(", ");

  return remainingCount > 0 ? `${baseText} e +${remainingCount}` : baseText;
}

function FeaturedTherapistCard({
  therapist,
}: {
  therapist: PublicHomeTherapist;
}) {
  const tags = getTherapistTags(therapist);
  const therapySummary = formatTherapies(therapist.therapyNames);

  return (
    <TESCard className="w-[292px] shrink-0 snap-start rounded-[28px] p-5 shadow-soft sm:w-[315px] xl:w-[220px] min-[1360px]:w-[240px] min-[1500px]:w-[268px] 2xl:w-[292px]">
      <div className="relative min-h-[252px] overflow-hidden rounded-[28px] bg-[#E8D9FF] xl:min-h-[220px] min-[1360px]:min-h-[232px] min-[1500px]:min-h-[238px] 2xl:min-h-[252px]">
        <Image
          src={therapist.photoUrl}
          alt={`Retrato de ${therapist.name}`}
          fill
          sizes="315px"
          className="object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-brand-deep/28 to-transparent" />
      </div>

      <div className="px-1 pb-2 pt-6 min-[1360px]:px-2">
        <h3 className="text-[1.45rem] font-extrabold leading-tight text-brand-deep min-[1360px]:text-[1.55rem] 2xl:text-[1.65rem]">
          {therapist.name}
        </h3>
        <p className="mt-2 text-xs font-extrabold leading-snug text-tesText-muted min-[1360px]:text-[0.82rem]">
          {therapySummary}
        </p>

        {tags.length ? (
          <div className="group mt-5 overflow-hidden border-y border-brand-lavender/35 py-3">
            <div className="flex min-w-max gap-3 transition-transform duration-700 group-hover:-translate-x-10">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-brand-lavender/40 bg-white px-4 py-2 text-sm font-extrabold text-brand-primary shadow-[0_8px_24px_rgba(108,61,145,0.08)] xl:text-xs min-[1500px]:text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex h-12 items-center gap-2 rounded-full border border-brand-lavender/40 bg-white px-4 text-sm font-extrabold text-tesText-muted shadow-[0_8px_24px_rgba(108,61,145,0.08)] xl:text-xs min-[1500px]:text-sm">
          <Star className="size-5 fill-[#FF9B3D] text-[#FF9B3D]" />
          <span className="text-[#F18D36]">{therapist.ratingLabel}</span>
          <span>{therapist.reviewCountLabel}</span>
        </div>

        <Link
          href={therapist.href as Route}
          className="mt-5 flex h-16 items-center justify-center gap-3 rounded-[18px] bg-brand-primary px-5 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover min-[1500px]:text-base"
        >
          Ver perfil completo
          <ArrowRight className="size-5" />
        </Link>
      </div>
    </TESCard>
  );
}

export function FeaturedTherapistsCarousel({
  therapists,
}: {
  therapists: PublicHomeTherapist[];
}) {
  const carouselRef = useRef<HTMLDivElement>(null);

  function scrollByCard(direction: "left" | "right") {
    const carousel = carouselRef.current;

    if (!carousel) {
      return;
    }

    carousel.scrollBy({
      behavior: "smooth",
      left: direction === "left" ? -340 : 340,
    });
  }

  return (
    <section className="mx-auto max-w-[1680px] px-5 py-16 sm:px-8 lg:px-8 2xl:px-12">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-primary">
            Terapeutas em destaque
          </p>
          <h2 className="font-display text-4xl font-light italic leading-tight text-brand-deep md:text-5xl">
            Profissionais verificados para voce conhecer com calma
          </h2>
        </div>
        <TESButton href={routes.public.therapists} variant="secondary">
          Ver todos os terapeutas
          <ArrowRight className="size-4" />
        </TESButton>
      </div>

      <div className="relative mt-9">
        <button
          type="button"
          aria-label="Ver terapeutas anteriores"
          onClick={() => scrollByCard("left")}
          className="absolute -left-6 top-1/2 z-20 hidden size-12 -translate-y-1/2 place-items-center rounded-full border border-brand-lavender/50 bg-white text-brand-primary shadow-card transition hover:-translate-x-0.5 hover:border-brand-primary md:grid 2xl:-left-8"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div
          ref={carouselRef}
          className="flex snap-x gap-5 overflow-x-auto scroll-smooth px-8 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] xl:gap-4 xl:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {therapists.map((therapist) => (
            <FeaturedTherapistCard
              key={therapist.slug}
              therapist={therapist}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Ver proximos terapeutas"
          onClick={() => scrollByCard("right")}
          className="absolute -right-6 top-1/2 z-20 hidden size-12 -translate-y-1/2 place-items-center rounded-full border border-brand-lavender/50 bg-white text-brand-primary shadow-card transition hover:translate-x-0.5 hover:border-brand-primary md:grid 2xl:-right-8"
        >
          <ArrowRight className="size-5" />
        </button>
      </div>
    </section>
  );
}
