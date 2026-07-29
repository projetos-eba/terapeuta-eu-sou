import Image from "next/image";
import {
  BadgeCheck,
  Clock,
  Crown,
  Heart,
  Leaf,
  Play,
  Share2,
  Sparkles,
  Star,
} from "lucide-react";

import { PublicFooter, PublicHeader } from "@/components/tes";
import { TrackedBookingLink } from "@/features/public-metrics";

import { AvailabilitySelector } from "./availability-selector";
import { ReviewsCarousel } from "./reviews-carousel";
import type { PublicTherapistProfile, TherapistProfileReview } from "../types";

function IconByName({ name }: { name: string }) {
  const className = "mx-auto size-[30px] text-status-info";
  if (name === "heart") return <Heart className={className} />;
  if (name === "clock") return <Clock className={className} />;
  if (name === "leaf") return <Leaf className={className} />;
  if (name === "star") return <Star className={className} />;
  return <Sparkles className={className} />;
}

function Hero({ profile }: { profile: PublicTherapistProfile }) {
  const primaryService = profile.services[0];

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(90deg,var(--tes-color-surface-default)_0%,var(--tes-color-surface-default)_62%,var(--tes-color-status-info-bg)_100%)]">
      <div className="mx-auto grid max-w-[1440px] gap-8 px-5 pb-8 pt-6 sm:px-8 lg:grid-cols-[520px_1fr] lg:px-[56px]">
        <div className="relative min-h-[360px] overflow-hidden rounded-b-[46%] rounded-t-[46%] lg:min-h-[410px]">
          <Image
            src={profile.heroImage}
            alt={`Retrato de ${profile.name}`}
            fill
            priority
            sizes="520px"
            className="object-cover"
          />
        </div>

        <div className="flex flex-col justify-center">
          <div className="flex flex-wrap gap-3">
            {profile.isVerified ? (
              <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-status-infoBg px-6 py-2 text-sm font-semibold text-status-info">
                <BadgeCheck className="size-4" />
                Perfil verificado
              </span>
            ) : null}
            {profile.plan === "premium_plus" ? (
              <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-status-warning/30 bg-status-warningBg px-6 py-2 text-sm font-semibold text-brand-deep">
                <Crown className="size-4" />
                Terapeuta Plus
              </span>
            ) : null}
          </div>

          <h1 className="mt-2 font-display text-[54px] font-light italic leading-[1.12] text-brand-deep md:text-[64px]">
            {profile.name}
          </h1>
          <div className="mt-2 flex flex-wrap gap-5">
            {profile.tags.map((tag) => (
              <span
                key={tag}
                className="font-display text-[20px] font-light italic text-status-info"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <p className="text-2xl font-semibold text-brand-deep">
              {profile.rating.average
                ? profile.rating.average.toLocaleString("pt-BR", {
                    maximumFractionDigits: 1,
                    minimumFractionDigits: 1,
                  })
                : "Novo"}
            </p>
            <div className="flex text-status-warning">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} className="size-5 fill-current" />
              ))}
            </div>
            <p className="text-sm text-brand-deep">
              {profile.rating.count} avaliação
              {profile.rating.count === 1 ? "" : "ões"}
            </p>
          </div>

          <p className="mt-4 max-w-[360px] text-sm font-semibold leading-6 text-tesText-secondary">
            {profile.headline}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            {profile.isAcceptingBookings && primaryService ? (
              <TrackedBookingLink
                href={primaryService.bookingUrl}
                serviceId={primaryService.id}
                therapistSlug={profile.slug}
                className="inline-flex h-[52px] w-[204px] items-center justify-center gap-3 rounded-[15px] bg-brand-primary text-sm font-extrabold text-white"
              >
                Agendar sessão
                <span>→</span>
              </TrackedBookingLink>
            ) : (
              <span className="inline-flex min-h-[52px] items-center justify-center rounded-[15px] bg-brand-lavenderSoft px-6 text-sm font-extrabold text-brand-primary">
                Agenda temporariamente indisponível
              </span>
            )}
            <button
              type="button"
              aria-label={
                profile.name
                  ? `Adicionar ${profile.name} aos favoritos`
                  : "Adicionar aos favoritos"
              }
              aria-pressed="false"
              className="grid size-[52px] place-items-center rounded-full border border-border bg-white text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            >
              <Heart className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Compartilhar perfil"
              className="grid size-[52px] place-items-center rounded-full border border-border bg-white text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            >
              <Share2 className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function IntroCards({ profile }: { profile: PublicTherapistProfile }) {
  return (
    <section className="mx-auto grid max-w-[1348px] gap-5 px-5 pt-8 md:grid-cols-3">
      <article className="rounded-[18px] border border-border bg-white p-9">
        <h2 className="font-display text-2xl font-light italic text-status-info">
          Minha essência
        </h2>
        <p className="mt-8 text-sm font-medium leading-[1.55] text-tesText-primary">
          {profile.content.essenceBody}
        </p>
        <div className="mt-8 grid grid-cols-2 gap-6">
          {profile.content.experienceYears ? (
            <div className="rounded-[9px] border border-brand-cyan/30 p-3 text-center">
              <Leaf className="mx-auto size-7 text-status-info" />
              <p className="mt-2 text-sm font-bold text-status-info">
                +{profile.content.experienceYears} anos
              </p>
              <p className="text-xs text-tesText-primary">de jornada</p>
            </div>
          ) : null}
          {profile.rating.sessionsCompleted ? (
            <div className="rounded-[9px] border border-brand-cyan/30 p-3 text-center">
              <Heart className="mx-auto size-7 text-status-info" />
              <p className="mt-2 text-sm font-bold text-status-info">
                {profile.rating.sessionsCompleted}
              </p>
              <p className="text-xs text-tesText-primary">
                sessões realizadas pela plataforma
              </p>
            </div>
          ) : null}
        </div>
      </article>

      <article className="rounded-[18px] border border-border bg-white p-9 text-center">
        <h2 className="font-display text-2xl font-light italic text-status-info">
          Como posso te guiar
        </h2>
        <div className="mt-8 grid grid-cols-3 gap-7">
          {profile.content.guideItems.map((item) => (
            <div key={item.label}>
              <IconByName name={item.icon} />
              <p className="mt-2 text-sm font-medium leading-[1.45] text-tesText-primary">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-[18px] border border-border bg-white p-9">
        <h2 className="font-display text-2xl font-light italic text-status-info">
          Um convite para você
        </h2>
        <div className="mt-4 grid gap-6 xl:grid-cols-[253px_1fr]">
          {profile.video ? (
            <a
              href={profile.video.url}
              className="relative grid h-[184px] place-items-center overflow-hidden rounded-[12px] bg-brand-deep text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            >
              <Image
                src={profile.video.thumbnailUrl}
                alt={profile.video.title}
                fill
                sizes="253px"
                className="object-cover opacity-75"
              />
              <Play className="relative z-10 size-12 fill-current" />
            </a>
          ) : (
            <div className="grid h-[184px] place-items-center rounded-[12px] border border-dashed border-brand-lavender bg-brand-lavenderSoft px-5 text-center text-sm font-semibold leading-6 text-brand-deep">
              Vídeo de apresentação indisponível no momento.
            </div>
          )}
          <p className="self-center text-sm font-medium leading-[1.55] text-tesText-primary">
            {profile.content.invitationBody}
          </p>
        </div>
      </article>
    </section>
  );
}

function Services({ profile }: { profile: PublicTherapistProfile }) {
  return (
    <section className="mx-auto mt-5 max-w-[1348px] rounded-[18px] border border-border bg-white p-7">
      <h2 className="font-display text-2xl font-light italic text-status-info">
        Vivências e terapias
      </h2>
      <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {profile.services.map((service) => (
          <article
            key={service.id}
            className="grid min-h-[192px] gap-5 rounded-[24px] border border-border p-4 sm:grid-cols-[108px_1fr]"
          >
            <div className="min-h-[96px] rounded-[18px] bg-brand-primary sm:min-h-0" />
            <div>
              <h3 className="font-display text-[21px] font-light italic text-brand-deep">
                {service.title}
              </h3>
              <p className="mt-3 min-h-[46px] text-sm leading-[1.5] text-tesText-secondary">
                {service.description}
              </p>
              <p className="mt-4 flex items-center gap-2 text-xs font-medium text-brand-deep">
                <Clock className="size-4" />
                {service.durationMinutes} min
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xl font-extrabold text-brand-deep">
                  {service.priceLabel}
                </p>
                <TrackedBookingLink
                  href={service.bookingUrl}
                  serviceId={service.id}
                  therapistSlug={profile.slug}
                  className="inline-flex min-h-11 items-center rounded-[12px] border border-status-info px-5 py-2 text-sm font-medium text-status-info transition hover:bg-status-infoBg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                >
                  Agendar
                </TrackedBookingLink>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function TherapistProfilePage({
  profile,
  reviews,
}: {
  profile: PublicTherapistProfile;
  reviews: TherapistProfileReview[];
}) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,var(--tes-color-surface-default)_0%,var(--tes-color-surface-soft)_42%,var(--tes-color-surface-default)_100%)] text-tesText-primary">
      <PublicHeader />
      <Hero profile={profile} />
      <IntroCards profile={profile} />
      <Services profile={profile} />
      <section className="mx-auto mt-8 grid max-w-[1348px] gap-8 px-5 pb-10 lg:grid-cols-[1.05fr_0.95fr]">
        <AvailabilitySelector
          services={profile.services}
          therapistSlug={profile.slug}
        />
        <ReviewsCarousel
          average={profile.rating.average}
          count={profile.rating.count}
          reviews={reviews}
        />
      </section>
      <PublicFooter />
    </main>
  );
}
