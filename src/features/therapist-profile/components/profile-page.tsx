import Image from "next/image";
import {
  BadgeCheck,
  Clock,
  Crown,
  Flower2,
  Heart,
  Leaf,
  Play,
  Share2,
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

export type TherapistProfilePageMode = "preview" | "public";

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

function Hero({
  mode,
  profile,
}: {
  mode: TherapistProfilePageMode;
  profile: PublicTherapistProfile;
}) {
  const primaryService = profile.services[0];
  const theme = publicProfileThemeById[profile.publicProfileTheme];

  return (
    <section
      className="relative overflow-hidden bg-[var(--profile-hero-background)] md:overflow-hidden"
      data-profile-theme={theme.id}
      style={theme.style}
    >
      <div className="absolute inset-x-0 top-0 h-[260px] overflow-hidden rounded-b-[36px] md:inset-0 md:h-full md:rounded-none">
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
      </div>
      <div className="relative z-20 mx-auto grid max-w-[1440px] gap-6 px-5 pb-10 pt-6 sm:px-8 md:grid-cols-[minmax(252px,0.9fr)_minmax(0,1.1fr)] md:items-center md:pb-8 md:pt-6 lg:grid-cols-[364px_1fr] lg:gap-8 lg:px-[56px]">
        <div
          className={`relative z-10 mx-auto mt-[88px] size-[210px] overflow-hidden max-md:!rounded-full sm:mt-[96px] sm:size-[224px] md:mx-0 md:mt-0 md:size-[252px] lg:size-[287px] ${profilePhotoShapeClassName(theme.photoShape)}`}
        >
          <Image
            src={profile.heroImage}
            alt={`Retrato de ${profile.name}`}
            fill
            priority
            sizes="(max-width: 767px) 320px, 520px"
            className="object-cover"
          />
        </div>

        <div className="flex min-w-0 flex-col items-center justify-center md:items-start">
          <div className="flex w-full flex-nowrap justify-center gap-1 md:justify-start md:gap-2">
            {profile.isVerified ? (
              <span className="inline-flex min-h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-border bg-status-infoBg px-2 py-1 text-xs font-semibold text-status-info sm:gap-2 sm:px-3 sm:text-sm">
                <BadgeCheck className="size-4" />
                Perfil verificado
              </span>
            ) : null}
            {profile.plan === "premium_plus" ? (
              <span className="inline-flex min-h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-status-warning/30 bg-status-warningBg px-2 py-1 text-xs font-semibold text-brand-deep sm:gap-2 sm:px-3 sm:text-sm">
                <Crown className="size-4" />
                Terapeuta Plus
              </span>
            ) : null}
          </div>

          <h1 className="mt-3 text-center font-display text-[48px] font-light italic leading-[1.05] text-brand-deep md:text-left md:text-[54px] lg:text-[64px]">
            {profile.name}
          </h1>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 md:justify-start">
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
              {profile.rating.count}{" "}
              {profile.rating.count === 1 ? "avaliação" : "avaliações"}
            </p>
          </div>

          <p className="mt-4 hidden max-w-[360px] text-sm font-semibold leading-6 text-tesText-secondary md:block">
            {profile.headline}
          </p>

          <ProfileActions
            mode={mode}
            primaryService={primaryService}
            profile={profile}
          />
        </div>
      </div>
    </section>
  );
}

function ProfileActions({
  mode,
  primaryService,
  profile,
}: {
  mode: TherapistProfilePageMode;
  primaryService: PublicTherapistProfile["services"][number] | undefined;
  profile: PublicTherapistProfile;
}) {
  const hasAvailableBooking = profile.isAcceptingBookings && primaryService;

  if (mode === "preview") {
    return (
      <div className="mt-7 flex w-full flex-wrap items-center justify-center gap-4 md:justify-start">
        {hasAvailableBooking ? (
          <span className="inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-[15px] bg-brand-primary text-sm font-extrabold text-white sm:w-[204px]">
            Agendar sessão
            <span>→</span>
          </span>
        ) : (
          <span className="inline-flex min-h-[52px] items-center justify-center rounded-[15px] bg-brand-lavenderSoft px-6 text-sm font-extrabold text-brand-primary">
            Agenda temporariamente indisponível
          </span>
        )}
        <span className="grid size-[52px] place-items-center rounded-full border border-border bg-white text-brand-primary">
          <Heart aria-hidden="true" className="size-5" />
        </span>
        <span className="grid size-[52px] place-items-center rounded-full border border-border bg-white text-brand-primary">
          <Share2 aria-hidden="true" className="size-5" />
        </span>
      </div>
    );
  }

  return (
    <div className="mt-7 flex w-full flex-wrap items-center justify-center gap-4 md:justify-start">
      {hasAvailableBooking ? (
        <TrackedBookingLink
          href={primaryService.bookingUrl}
          serviceId={primaryService.id}
          therapistSlug={profile.slug}
          className="inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-[15px] bg-brand-primary text-sm font-extrabold text-white sm:w-[204px]"
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
  );
}

function IntroCards({
  mode,
  profile,
}: {
  mode: TherapistProfilePageMode;
  profile: PublicTherapistProfile;
}) {
  const videoEmbedUrl = getPublicVideoEmbedUrl(profile.video);
  const guideItems = profile.content.guideItems.slice(0, 4);

  return (
    <section className="mx-auto grid max-w-[1348px] gap-5 px-5 pt-8 sm:px-8 md:grid-cols-3">
      <article className="rounded-[22px] border border-brand-lavender bg-white p-6 shadow-card sm:p-9 md:shadow-none">
        <div className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-5 md:block">
          <span className="grid size-24 place-items-center rounded-[28px] bg-brand-lavenderSoft text-brand-primary md:hidden">
            <Flower2 aria-hidden="true" className="size-12" />
          </span>
          <div>
            <h2 className="font-display text-2xl font-light italic text-status-info">
              Minha essência
            </h2>
            <p className="mt-5 text-base font-medium leading-[1.6] text-tesText-primary md:mt-8 md:text-sm md:leading-[1.55]">
              {profile.content.essenceBody}
            </p>
          </div>
        </div>
        <div className="mt-8 hidden grid-cols-2 gap-6 md:grid">
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

      <article className="rounded-[22px] border border-brand-lavender bg-white p-6 shadow-card sm:p-9 md:text-center md:shadow-none">
        <h2 className="font-display text-2xl font-light italic text-status-info">
          Como posso te guiar
        </h2>
        <div
          aria-label="Caminhos pelos quais posso te guiar"
          className="mt-7 grid grid-cols-2 gap-x-4 gap-y-7 sm:gap-x-6"
          role="list"
        >
          {guideItems.map((item, index) => (
            <div
              className={`grid content-start gap-3 px-2 text-center ${index % 2 === 1 ? "border-l border-brand-lavender" : ""} ${guideItems.length % 2 === 1 && index === guideItems.length - 1 ? "col-span-2 mx-auto w-full max-w-[180px] border-l-0" : ""}`}
              key={item.label}
              role="listitem"
            >
              <span className="mx-auto grid size-[68px] place-items-center rounded-full bg-brand-lavenderSoft sm:size-[72px]">
                <IconByName name={item.icon} />
              </span>
              <p className="text-sm font-medium leading-[1.45] text-tesText-primary">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-[22px] border border-brand-lavender bg-white p-6 shadow-card sm:p-9 md:shadow-none">
        <h2 className="font-display text-2xl font-light italic text-status-info">
          Um convite para você
        </h2>
        <div className="mt-5 grid gap-5">
          {profile.video && videoEmbedUrl && mode === "public" ? (
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
          ) : profile.video?.provider === "upload" && mode === "public" ? (
            <video
              className="h-[184px] w-full rounded-[12px] bg-brand-deep object-cover"
              controls
              poster={profile.video.thumbnailUrl}
              preload="metadata"
              src={profile.video.url}
            >
              Seu navegador não conseguiu carregar este vídeo.
            </video>
          ) : profile.video && mode === "preview" ? (
            <div className="relative grid h-[184px] place-items-center overflow-hidden rounded-[12px] bg-brand-deep text-white">
              <Image
                src={profile.video.thumbnailUrl}
                alt={profile.video.title}
                fill
                sizes="253px"
                className="object-cover opacity-75"
              />
              <Play className="relative z-10 size-12 fill-current" />
            </div>
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
            <div
              aria-label="Vídeo de apresentação indisponível no momento"
              className="grid h-[184px] place-items-center rounded-[12px] border border-brand-lavender bg-brand-lavenderSoft px-5 text-center text-brand-deep"
              role="img"
            >
              <span className="grid size-16 place-items-center rounded-full bg-white text-brand-primary shadow-card">
                <Play aria-hidden="true" className="ml-1 size-7 fill-current" />
              </span>
            </div>
          )}
          <p className="text-sm font-medium leading-[1.55] text-tesText-primary">
            {profile.content.invitationBody}
          </p>
        </div>
      </article>
    </section>
  );
}

function Services({
  mode,
  profile,
}: {
  mode: TherapistProfilePageMode;
  profile: PublicTherapistProfile;
}) {
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
      <div
        aria-label="Vivências e terapias disponíveis"
        className="mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-3 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:snap-none md:overflow-visible md:pb-0 lg:grid-cols-2"
        role="list"
      >
        {profile.services.map((service) => (
          <article
            key={service.id}
            className="grid w-[calc(100%-1rem)] min-w-0 shrink-0 snap-start gap-5 overflow-hidden rounded-[18px] border border-border bg-white p-5 shadow-card sm:grid-cols-[128px_minmax(0,1fr)] md:w-auto md:shrink md:snap-none"
            role="listitem"
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
              {service.themeNames.length ? (
                <div
                  className="mt-3 flex flex-wrap gap-2"
                  aria-label="Temas desta terapia"
                >
                  {service.themeNames.slice(0, 3).map((theme) => (
                    <span
                      className="inline-flex max-w-full rounded-full bg-brand-lavenderSoft px-2.5 py-1 text-[11px] font-bold text-brand-primary"
                      key={theme}
                    >
                      <span className="truncate">{theme}</span>
                    </span>
                  ))}
                  {service.themeNames.length > 3 ? (
                    <span className="inline-flex rounded-full bg-brand-cyanSoft px-2.5 py-1 text-[11px] font-bold text-status-info">
                      +{service.themeNames.length - 3} temas
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-3 flex min-w-0 items-center justify-between gap-3">
                <p className="text-xl font-extrabold text-brand-deep">
                  {service.priceLabel}
                </p>
                {mode === "preview" ? (
                  <span className="inline-flex min-h-11 items-center rounded-[12px] border border-status-info px-5 py-2 text-sm font-medium text-status-info">
                    Agendar
                  </span>
                ) : (
                  <TrackedBookingLink
                    href={service.bookingUrl}
                    serviceId={service.id}
                    therapistSlug={profile.slug}
                    className="inline-flex min-h-11 items-center rounded-[12px] border border-status-info px-5 py-2 text-sm font-medium text-status-info transition hover:bg-status-infoBg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                  >
                    Agendar
                  </TrackedBookingLink>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function TherapistProfilePage({
  mode = "public",
  profile,
  reviews,
}: {
  mode?: TherapistProfilePageMode;
  profile: PublicTherapistProfile;
  reviews: TherapistProfileReview[];
}) {
  const Root = mode === "preview" ? "div" : "main";

  return (
    <Root className="min-h-screen bg-[linear-gradient(180deg,var(--tes-color-surface-default)_0%,var(--tes-color-surface-soft)_42%,var(--tes-color-surface-default)_100%)] text-tesText-primary">
      <PublicHeader showMobileSearch staticPreview={mode === "preview"} />
      <Hero mode={mode} profile={profile} />
      <IntroCards mode={mode} profile={profile} />
      <Services mode={mode} profile={profile} />
      <section className="mx-auto mt-8 grid max-w-[1348px] items-start gap-8 px-5 pb-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
        <AvailabilitySelector
          staticPreview={mode === "preview"}
          services={profile.services}
          therapistSlug={profile.slug}
        />
        <ReviewsCarousel
          average={profile.rating.average}
          count={profile.rating.count}
          reviews={reviews}
          staticPreview={mode === "preview"}
        />
      </section>
      <PublicFooter variant="profile" />
    </Root>
  );
}
