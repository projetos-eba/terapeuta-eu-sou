import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
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

import { AvailabilitySelector } from "./availability-selector";
import { ReviewsCarousel } from "./reviews-carousel";
import type { PublicTherapistProfile, TherapistProfileReview } from "../types";

function IconByName({ name }: { name: string }) {
  const className = "mx-auto size-[30px] text-[#639abe]";
  if (name === "heart") return <Heart className={className} />;
  if (name === "clock") return <Clock className={className} />;
  if (name === "leaf") return <Leaf className={className} />;
  if (name === "star") return <Star className={className} />;
  return <Sparkles className={className} />;
}

function Hero({ profile }: { profile: PublicTherapistProfile }) {
  const primaryService = profile.services[0];

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(90deg,#fff_0%,#fff_62%,#eef8fc_100%)]">
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
              <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(231,229,234,0.77)] bg-[#eef8fc] px-6 py-2 text-xs font-semibold text-[#639abe]">
                <BadgeCheck className="size-4" />
                Perfil verificado
              </span>
            ) : null}
            {profile.plan === "premium_plus" ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(231,229,234,0.77)] bg-[rgba(244,184,74,0.54)] px-6 py-2 text-xs font-semibold text-[#af812c]">
                <Crown className="size-4" />
                Terapeuta Plus
              </span>
            ) : null}
          </div>

          <h1 className="mt-2 font-display text-[54px] font-light italic leading-[1.12] text-[#482861] md:text-[64px]">
            {profile.name}
          </h1>
          <div className="mt-2 flex flex-wrap gap-5">
            {profile.tags.map((tag) => (
              <span
                key={tag}
                className="font-display text-[20px] font-light italic text-[#639abe]"
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
            <div className="flex text-[#f4b84a]">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} className="size-5 fill-current" />
              ))}
            </div>
            <p className="text-sm text-brand-deep">
              {profile.rating.count} avaliação{profile.rating.count === 1 ? "" : "ões"}
            </p>
          </div>

          <p className="mt-4 max-w-[360px] text-xs font-semibold leading-5 text-[#5e5a8a]">
            {profile.headline}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            {profile.isAcceptingBookings && primaryService ? (
              <Link
                href={primaryService.bookingUrl as Route}
                className="inline-flex h-[52px] w-[204px] items-center justify-center gap-3 rounded-[15px] bg-brand-primary text-sm font-extrabold text-white"
              >
                Agendar sessão
                <span>→</span>
              </Link>
            ) : (
              <span className="inline-flex h-[52px] items-center justify-center rounded-[15px] bg-[#e8e2f6] px-6 text-sm font-extrabold text-brand-primary">
                Agenda temporariamente indisponível
              </span>
            )}
            <button className="grid size-[52px] place-items-center rounded-full border border-[#ded5f2] bg-white text-brand-primary">
              <Heart className="size-5" />
            </button>
            <button className="grid size-[52px] place-items-center rounded-full border border-[#ded5f2] bg-white text-brand-primary">
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
      <article className="rounded-[18px] border border-[#e9ddf6] bg-white p-9">
        <h2 className="font-display text-2xl font-light italic text-[#639abe]">
          Minha essência
        </h2>
        <p className="mt-8 text-xs font-medium leading-[1.5] text-[#17105c]">
          {profile.content.essenceBody}
        </p>
        <div className="mt-8 grid grid-cols-2 gap-6">
          {profile.content.experienceYears ? (
            <div className="rounded-[9px] border border-[#dce9f2] p-3 text-center">
              <Leaf className="mx-auto size-7 text-[#639abe]" />
              <p className="mt-2 text-xs font-bold text-[#639abe]">
                +{profile.content.experienceYears} anos
              </p>
              <p className="text-[10px] text-[#17105c]">de jornada</p>
            </div>
          ) : null}
          {profile.rating.sessionsCompleted ? (
            <div className="rounded-[9px] border border-[#dce9f2] p-3 text-center">
              <Heart className="mx-auto size-7 text-[#639abe]" />
              <p className="mt-2 text-xs font-bold text-[#639abe]">
                {profile.rating.sessionsCompleted}
              </p>
              <p className="text-[10px] text-[#17105c]">
                sessões realizadas pela plataforma
              </p>
            </div>
          ) : null}
        </div>
      </article>

      <article className="rounded-[18px] border border-[#e9ddf6] bg-white p-9 text-center">
        <h2 className="font-display text-2xl font-light italic text-[#639abe]">
          Como posso te guiar
        </h2>
        <div className="mt-8 grid grid-cols-3 gap-7">
          {profile.content.guideItems.map((item) => (
            <div key={item.label}>
              <IconByName name={item.icon} />
              <p className="mt-2 text-[10px] font-medium leading-[1.35] text-[#17105c]">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-[18px] border border-[#e9ddf6] bg-white p-9">
        <h2 className="font-display text-2xl font-light italic text-[#639abe]">
          Um convite para você
        </h2>
        <div className="mt-4 grid gap-6 md:grid-cols-[253px_1fr]">
          <a
            href={profile.video?.url}
            className="relative grid h-[184px] place-items-center overflow-hidden rounded-[12px] bg-[#8c522e] text-white"
          >
            {profile.video?.thumbnailUrl ? (
              <Image
                src={profile.video.thumbnailUrl}
                alt={profile.video.title}
                fill
                sizes="253px"
                className="object-cover opacity-75"
              />
            ) : null}
            <Play className="relative z-10 size-12 fill-current" />
          </a>
          <p className="self-center text-[10px] font-medium leading-[1.5] text-[#17105c]">
            {profile.content.invitationBody}
          </p>
        </div>
      </article>
    </section>
  );
}

function Services({ profile }: { profile: PublicTherapistProfile }) {
  return (
    <section className="mx-auto mt-5 max-w-[1348px] rounded-[18px] border border-[#e9ddf6] bg-white p-7">
      <h2 className="font-display text-2xl font-light italic text-[#639abe]">
        Vivências e terapias
      </h2>
      <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {profile.services.map((service) => (
          <article
            key={service.id}
            className="grid min-h-[192px] grid-cols-[108px_1fr] gap-5 rounded-[24px] border border-[#e8e2f6] p-4"
          >
            <div className="bg-brand-primary" />
            <div>
              <h3 className="font-display text-[21px] font-light italic text-[#482861]">
                {service.title}
              </h3>
              <p className="mt-3 min-h-[46px] text-[10px] leading-[1.5] text-[#5e5a8a]">
                {service.description}
              </p>
              <p className="mt-4 flex items-center gap-2 text-xs font-medium text-brand-deep">
                <Clock className="size-4" />
                {service.durationMinutes} min
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xl font-extrabold text-[#482861]">
                  {service.priceLabel}
                </p>
                <Link
                  href={service.bookingUrl as Route}
                  className="rounded-[12px] border border-[#639abe] px-5 py-2 text-xs font-medium text-[#639abe]"
                >
                  Agendar
                </Link>
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
    <main className="min-h-screen bg-[linear-gradient(180deg,#fff_0%,#fafafa_42%,#fff_100%)] text-tesText-primary">
      <PublicHeader />
      <Hero profile={profile} />
      <IntroCards profile={profile} />
      <Services profile={profile} />
      <section className="mx-auto mt-8 grid max-w-[1348px] gap-8 px-5 pb-10 lg:grid-cols-[1.05fr_0.95fr]">
        <AvailabilitySelector services={profile.services} />
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
