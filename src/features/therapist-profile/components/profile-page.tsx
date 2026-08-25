import Image from "next/image";
import {
  BadgeCheck,
  Clock,
  Crown,
  Heart,
  Leaf,
  Play,
  Sparkles,
  Star,
} from "lucide-react";

import { PublicFooter, PublicHeader } from "@/components/tes";
import { TrackedBookingLink } from "@/features/public-metrics";
import {
  profilePhotoShapeClassName,
  publicProfileThemeById,
} from "@/features/therapist-profile/personalization";
import { therapyDetailIconOptions } from "@/features/therapies/components/detail/detail-icons";

import { AvailabilitySelector } from "./availability-selector";
import { FavoriteTherapistButton } from "./favorite-therapist-button";
import { ProfileShareButton } from "./profile-share-button";
import { ReviewsCarousel } from "./reviews-carousel";
import type { PublicTherapistProfile, TherapistProfileReview } from "../types";
import { getPublicVideoEmbedUrl } from "../video-embed";

function IconByName({ name }: { name: string }) {
  const className = "mx-auto size-[30px] text-status-info";
  if (name === "heart") return <Heart className={className} />;
  if (name === "clock") return <Clock className={className} />;
  if (name === "leaf") return <Leaf className={className} />;
  if (name === "star") return <Star className={className} />;
  const option = therapyDetailIconOptions.find((item) => item.key === name);
  if (option) {
    const Icon = option.icon;
    return <Icon className={className} />;
  }
  return <Sparkles className={className} />;
}

function Hero({ profile }: { profile: PublicTherapistProfile }) {
  const primaryService = profile.services[0];
  const theme = publicProfileThemeById[profile.publicProfileTheme];

  return (
    <section
      className="relative overflow-hidden bg-[var(--profile-hero-background)]"
      data-profile-theme={theme.id}
      style={theme.style}
    >
      {(theme.backgroundAsset ?? theme.heroBackgroundSrc) ? (
        <Image
          aria-hidden="true"
          alt=""
          className="pointer-events-none object-cover object-center"
          data-theme-hero-background={theme.id}
          fill
          priority
          sizes="100vw"
          src={theme.backgroundAsset ?? theme.heroBackgroundSrc ?? ""}
        />
      ) : (
        <div className="pointer-events-none absolute -right-24 -top-40 size-[420px] rounded-full bg-[var(--profile-shape)] opacity-60" />
      )}
      {theme.heroIllustrationSrc ? (
        <Image
          aria-hidden="true"
          alt=""
          className={`pointer-events-none absolute z-10 hidden object-contain opacity-45 xl:block ${theme.heroIllustrationClassName ?? ""}`}
          data-theme-hero-illustration={theme.id}
          height={1402}
          sizes="(min-width: 1280px) 33vw, 0px"
          src={theme.heroIllustrationSrc}
          width={1122}
        />
      ) : null}
      <div className="relative z-20 mx-auto grid max-w-[1440px] gap-6 px-5 pb-8 pt-6 sm:px-8 md:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)] md:items-center lg:grid-cols-[520px_1fr] lg:gap-8 lg:px-[56px]">
        <div
          className={`relative min-h-[300px] overflow-hidden sm:min-h-[340px] md:min-h-[360px] lg:min-h-[410px] ${profilePhotoShapeClassName(theme.photoShape)}`}
        >
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

          <h1 className="mt-2 font-display text-[54px] font-light italic leading-[1.12] text-brand-deep md:text-[54px] lg:text-[64px]">
            {profile.name}
          </h1>
          <div className="mt-2 flex flex-wrap gap-5">
            {profile.tags.map((tag) => (
              <span
                key={tag}
                className="font-display text-[20px] font-light italic text-[var(--profile-accent)]"
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
              {profile.rating.count} {profile.rating.count === 1 ? "avaliação" : "avaliações"}
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
            <FavoriteTherapistButton
              therapistName={profile.name}
              therapistProfileId={profile.id}
            />
            <ProfileShareButton profilePath={profile.profileUrl} />
          </div>
        </div>
      </div>
    </section>
  );
}

function IntroCards({ profile }: { profile: PublicTherapistProfile }) {
  const videoEmbedUrl = getPublicVideoEmbedUrl(profile.video);

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
          {profile.video && videoEmbedUrl ? (
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-[184px] w-full rounded-[12px] border-0 bg-brand-deep"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-presentation allow-same-origin allow-scripts"
              src={videoEmbedUrl}
              title={profile.video.title}
            />
          ) : profile.video?.provider === "upload" ? (
            <video
              className="h-[184px] w-full rounded-[12px] bg-brand-deep object-cover"
              controls
              poster={profile.video.thumbnailUrl}
              preload="metadata"
              src={profile.video.url}
            >
              Seu navegador não conseguiu carregar este vídeo.
            </video>
          ) : profile.video ? (
            <a
              href={profile.video.url}
              className="relative grid h-[184px] place-items-center overflow-hidden rounded-[12px] bg-brand-deep text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              rel="noreferrer"
              target="_blank"
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
  if (!profile.services.length) {
    return null;
  }

  return (
    <section className="mx-auto mt-8 max-w-[1348px] px-5 sm:px-8">
      <div>
        <h2 className="font-display text-3xl font-light italic text-status-info">
          Vivências e terapias
        </h2>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {profile.services.map((service) => (
          <article
            key={service.id}
            className="grid min-h-[220px] gap-5 overflow-hidden rounded-[18px] border border-border bg-white p-5 shadow-card sm:grid-cols-[128px_minmax(0,1fr)]"
          >
            <div className="relative grid min-h-[112px] place-items-center overflow-hidden rounded-[16px] bg-brand-lavenderSoft text-brand-primary sm:min-h-0">
              {service.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- imagem administrada pelo catálogo público.
                <img
                  alt={`Imagem da terapia ${service.therapyName}`}
                  className="size-full object-cover"
                  src={service.imageUrl}
                />
              ) : (
                <Sparkles className="size-8" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="break-words font-display text-[26px] font-light italic leading-tight text-brand-deep [overflow-wrap:anywhere]">
                {service.therapyName}
              </h3>
              <p className="mt-3 min-h-[46px] max-w-full overflow-hidden break-words text-sm leading-[1.5] text-tesText-secondary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] [overflow-wrap:anywhere]">
                {service.description}
              </p>
              <p className="mt-4 flex items-center gap-2 text-xs font-medium text-brand-deep">
                <Clock className="size-4" />
                {service.durationMinutes} min
              </p>
              <div className="mt-3 flex min-w-0 items-center justify-between gap-3">
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
      <section className="mx-auto mt-8 grid max-w-[1348px] items-start gap-8 px-5 pb-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
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
