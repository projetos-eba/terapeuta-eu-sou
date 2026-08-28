"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PremiumTherapistBadge, TESButton, TESCard } from "@/components/tes";
import type {
  PublicHomeFeaturedTherapistsPage,
  PublicHomeTherapist,
} from "@/features/public-home";
import { buildPublicTherapistTherapyChips } from "@/features/public-therapists/therapy-presentation";
import { routes } from "@/lib/routes";

function getTherapistTags(therapist: PublicHomeTherapist) {
  return therapist.guideItems?.slice(0, 6) ?? [];
}

function getTherapyChips(therapist: PublicHomeTherapist) {
  if (therapist.therapies?.length) {
    return therapist.therapies.slice(0, 3);
  }

  return buildPublicTherapistTherapyChips(
    therapist.therapyNames?.map((name) => ({
      name,
      slug: name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
    })) ?? [],
    3,
  );
}

function getFeaturedTherapistIdentity(therapist: PublicHomeTherapist) {
  return `${therapist.name.trim().toLocaleLowerCase("pt-BR")}|${therapist.photoUrl}`;
}

function FeaturedTherapistCard({
  therapist,
}: {
  therapist: PublicHomeTherapist;
}) {
  const tags = getTherapistTags(therapist);
  const therapyChips = getTherapyChips(therapist);

  return (
    <TESCard className="flex h-full w-[292px] shrink-0 flex-col rounded-[28px] p-5 shadow-soft sm:w-[315px] xl:w-[220px] min-[1360px]:w-[240px] min-[1500px]:w-[268px] 2xl:w-[292px]">
      <div className="relative min-h-[252px] overflow-hidden rounded-[28px] bg-brand-lavender xl:min-h-[220px] min-[1360px]:min-h-[232px] min-[1500px]:min-h-[238px] 2xl:min-h-[252px]">
        <Image
          src={therapist.photoUrl}
          alt={`Retrato de ${therapist.name}`}
          fill
          quality={95}
          sizes="315px"
          className="object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-brand-deep/28 to-transparent" />
        {therapist.isPremium ? (
          <PremiumTherapistBadge therapistName={therapist.name} />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-1 pb-2 pt-6 min-[1360px]:px-2">
        <h3 className="min-h-[3.5rem] text-[1.45rem] font-extrabold leading-tight text-brand-deep min-[1360px]:text-[1.55rem] 2xl:text-[1.65rem]">
          {therapist.name}
        </h3>
        <div className="mt-3 min-h-[34px]">
          {therapyChips.length ? (
            <ul
              aria-label={`Terapias oferecidas por ${therapist.name}`}
              className="flex min-h-[34px] flex-wrap gap-2"
            >
              {therapyChips.map((therapy) => (
                <li key={therapy.id}>
                  <span
                    className="block max-w-[180px] truncate rounded-full bg-brand-lavenderSoft px-3 py-1.5 text-[11px] font-extrabold leading-4 text-brand-primary"
                    title={therapy.label}
                  >
                    {therapy.label}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="min-h-[34px] text-xs font-extrabold leading-snug text-tesText-muted min-[1360px]:text-[0.82rem]">
              Terapias publicadas no perfil
            </p>
          )}
        </div>

        <div className="mt-5 h-[60px] min-h-[60px] overflow-hidden border-y border-brand-lavender/35 py-3">
          {tags.length ? (
            <div className="tes-therapist-tags-marquee flex w-max">
              {[0, 1].map((copy) => (
                <div
                  key={copy}
                  aria-hidden={copy === 1}
                  className="flex shrink-0 gap-3 pr-3"
                >
                  {tags.map((tag, index) => (
                    <span
                      key={`${copy}-${tag}-${index}`}
                      className="whitespace-nowrap rounded-full border border-brand-lavender/40 bg-white px-4 py-2 text-sm font-extrabold text-brand-primary shadow-[0_8px_24px_rgba(108,61,145,0.08)] xl:text-xs min-[1500px]:text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-auto flex h-12 items-center gap-2 rounded-full border border-brand-lavender/40 bg-white px-4 text-sm font-extrabold text-tesText-muted shadow-[0_8px_24px_rgba(108,61,145,0.08)] xl:text-xs min-[1500px]:text-sm">
          <Star className="size-5 fill-status-warning text-status-warning" />
          <span className="text-status-warning">{therapist.ratingLabel}</span>
          <span>{therapist.reviewCountLabel}</span>
        </div>

        <TESButton
          href={therapist.href}
          size="lg"
          className="mt-5 h-16 min-h-16 w-full rounded-[18px] px-5 py-0 shadow-card min-[1500px]:text-base"
        >
          Ver perfil completo
          <ArrowRight className="size-5" />
        </TESButton>
      </div>
    </TESCard>
  );
}

export function FeaturedTherapistsCarousel({
  initialPage,
  therapists,
}: {
  initialPage?: PublicHomeFeaturedTherapistsPage;
  therapists: PublicHomeTherapist[];
}) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const [loadedTherapists, setLoadedTherapists] = useState(therapists);
  const [nextCursor, setNextCursor] = useState(initialPage?.nextCursor ?? null);
  const [hasMore, setHasMore] = useState(initialPage?.hasMore ?? false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [canOverflow, setCanOverflow] = useState(false);
  const [hasMeasuredOverflow, setHasMeasuredOverflow] = useState(false);

  const isLooping = !hasMore && canOverflow;

  const carouselTherapists = useMemo(
    () =>
      isLooping ? [...loadedTherapists, ...loadedTherapists] : loadedTherapists,
    [isLooping, loadedTherapists],
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const searchParams = new URLSearchParams({
        freeOffset: String(nextCursor.freeOffset),
        paidOffset: String(nextCursor.paidOffset),
      });
      const response = await fetch(
        `/api/public/home/featured-therapists?${searchParams.toString()}`,
      );

      if (!response.ok) {
        setHasMore(false);
        setNextCursor(null);
        return;
      }

      const page = (await response.json()) as PublicHomeFeaturedTherapistsPage;

      setLoadedTherapists((current) => {
        const knownIdentities = new Set(
          current.map(getFeaturedTherapistIdentity),
        );
        return [
          ...current,
          ...page.therapists.filter(
            (therapist) =>
              !knownIdentities.has(getFeaturedTherapistIdentity(therapist)),
          ),
        ];
      });
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
    } catch {
      setHasMore(false);
      setNextCursor(null);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, nextCursor]);

  useEffect(() => {
    const carousel = carouselRef.current;

    if (!carousel) {
      return;
    }

    const measureOverflow = () => {
      const gap = Number.parseFloat(getComputedStyle(carousel).columnGap) || 0;
      const contentWidth = isLooping
        ? (carousel.scrollWidth - gap) / 2
        : carousel.scrollWidth;

      setCanOverflow(contentWidth > carousel.clientWidth + 1);
      setHasMeasuredOverflow(true);
    };
    const observer = new ResizeObserver(measureOverflow);

    measureOverflow();
    observer.observe(carousel);

    return () => observer.disconnect();
  }, [isLooping, loadedTherapists.length]);

  useEffect(() => {
    if (hasMeasuredOverflow && hasMore && !canOverflow) {
      void loadMore();
    }
  }, [canOverflow, hasMeasuredOverflow, hasMore, loadMore]);

  useEffect(() => {
    if (
      !loadedTherapists.length ||
      !canOverflow ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let animationFrame = 0;
    let previousTime = performance.now();
    const animate = (now: number) => {
      const carousel = carouselRef.current;

      if (carousel && !pausedRef.current) {
        // scrollLeft is rounded to whole pixels by several browsers. Keeping a
        // one-pixel minimum prevents low per-frame deltas from becoming zero.
        const distance = Math.max(1, ((now - previousTime) * 36) / 1000);
        const cycleWidth = carousel.scrollWidth / (isLooping ? 2 : 1);

        if (isLooping && cycleWidth > 0 && carousel.scrollLeft >= cycleWidth) {
          carousel.scrollLeft -= cycleWidth;
        }

        carousel.scrollLeft += distance;
      }

      previousTime = now;
      animationFrame = window.requestAnimationFrame(animate);
    };

    animationFrame = window.requestAnimationFrame(animate);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [canOverflow, isLooping, loadedTherapists.length]);

  function handleScroll() {
    const carousel = carouselRef.current;

    if (
      carousel &&
      hasMore &&
      carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 720
    ) {
      void loadMore();
    }
  }

  if (!loadedTherapists.length) {
    return null;
  }

  return (
    <section className="mx-auto max-w-[1680px] px-5 py-16 sm:px-8 lg:px-8 2xl:px-12">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-primary">
            Terapeutas em destaque
          </p>
          <h2 className="font-display text-4xl font-light italic leading-tight text-brand-deep md:text-5xl">
            Profissionais verificados para você conhecer
          </h2>
        </div>
        <TESButton href={routes.public.therapists} variant="secondary">
          Ver todos os terapeutas
          <ArrowRight className="size-4" />
        </TESButton>
      </div>

      <div className="relative mt-9">
        <div
          ref={carouselRef}
          aria-label="Carrossel de terapeutas em destaque"
          className="flex gap-5 overflow-x-auto px-8 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] xl:gap-4 xl:px-0 [&::-webkit-scrollbar]:hidden"
          onBlurCapture={() => {
            pausedRef.current = false;
          }}
          onFocusCapture={() => {
            pausedRef.current = true;
          }}
          onMouseEnter={() => {
            pausedRef.current = true;
          }}
          onMouseLeave={() => {
            pausedRef.current = false;
          }}
          onPointerDown={() => {
            pausedRef.current = true;
          }}
          onPointerUp={() => {
            pausedRef.current = false;
          }}
          onPointerCancel={() => {
            pausedRef.current = false;
          }}
          onScroll={handleScroll}
        >
          {carouselTherapists.map((therapist, index) => (
            <FeaturedTherapistCard
              key={`${therapist.slug}-${index}`}
              therapist={therapist}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
