import Image from "next/image";
import { ArrowRight, Star } from "lucide-react";

import { PublicFooter, PublicHeader, TESButton } from "@/components/tes";
import { TherapistPlan, getPlanSignupHref } from "@/domain/tes";
import { cn } from "@/lib/utils";

import { benefitCards, forTherapistsHero, trustItems } from "./content";
import { PlansPreviewSection } from "./plan-comparison";

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#fff_0%,#faf7ff_54%,#fff_100%)] px-5 pb-14 pt-12 sm:px-8 lg:px-12 lg:pb-20">
      <div className="pointer-events-none absolute left-0 top-[430px] h-[180px] w-[180px] rounded-full border border-brand-lavender/50 opacity-40" />
      <div className="pointer-events-none absolute inset-y-0 right-0 -z-10 h-[680px] w-full opacity-45 sm:opacity-55 lg:w-[min(62vw,1180px)]">
        <Image
          src="/for-therapists/hero-therapist-laptop.png"
          alt=""
          fill
          priority
          quality={95}
          sizes="(min-width: 1920px) 1180px, (min-width: 1024px) 62vw, 100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#ffffff_0%,rgba(255,255,255,0.92)_28%,rgba(255,255,255,0.58)_58%,rgba(255,255,255,0.2)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,#ffffff_92%)]" />
      </div>

      <div className="mx-auto flex max-w-[1320px] flex-col items-center text-center">
        <p className="text-sm font-extrabold uppercase tracking-[0.48em] text-brand-primary">
          {forTherapistsHero.eyebrow}
        </p>
        <h1 className="mt-8 max-w-full break-words text-[42px] font-semibold leading-[1.1] text-brand-deep sm:max-w-4xl sm:text-[54px]">
          {forTherapistsHero.title}
          <span className="mt-2 block bg-[linear-gradient(90deg,#6C3D91_0%,#81BAE0_100%)] bg-clip-text font-display text-[50px] font-light italic leading-[1.08] text-transparent sm:text-[70px]">
            {forTherapistsHero.accent}
          </span>
        </h1>
        <p className="mt-7 max-w-2xl text-lg font-semibold leading-8 text-tesText-secondary">
          {forTherapistsHero.body}
        </p>

        <div className="mt-9 flex flex-col gap-4 sm:flex-row">
          <TESButton
            href={getPlanSignupHref(TherapistPlan.Free)}
            variant="gradient"
            className="min-h-[55px] px-8 text-base"
          >
            {forTherapistsHero.primaryCta}
            <ArrowRight className="size-4" />
          </TESButton>
          <TESButton
            href="#planos"
            variant="secondary"
            className="min-h-[55px] px-8 text-base"
          >
            {forTherapistsHero.secondaryCta}
          </TESButton>
        </div>

        <div className="mt-8 grid w-full max-w-[954px] gap-2 sm:mt-12 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 lg:gap-8">
          {trustItems.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="flex min-h-10 items-center justify-center gap-2 rounded-full bg-white/70 px-3 py-2 text-xs font-extrabold text-[#534c99] shadow-card sm:min-h-14 sm:gap-3 sm:px-4 sm:py-3 sm:text-sm lg:justify-start lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none"
              >
                <Icon
                  className="size-5 text-brand-primary sm:size-7"
                  strokeWidth={1.8}
                />
                {item.label}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProfilePreview() {
  return (
    <div className="mt-7 rounded-[18px] border border-brand-lavender/60 bg-white/90 px-4 py-5 text-center shadow-card xl:mt-8">
      <div className="relative mx-auto size-[65px] overflow-hidden rounded-full bg-[#f7f0e8]">
        <Image
          src="/therapists/ana-oliveira.png"
          alt="Preview de perfil profissional"
          fill
          sizes="65px"
          className="object-cover"
        />
      </div>
      <p className="mt-5 text-xl font-extrabold text-brand-deep">
        Juliana Almeida
      </p>
      <p className="font-display text-lg font-light italic text-[#534c99]">
        Terapeuta integrativa
      </p>
      <div className="mt-4 flex items-center justify-center gap-1 text-[#f4b84a]">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star key={index} className="size-4 fill-current" />
        ))}
        <span className="ml-2 text-sm font-extrabold text-brand-deep">5.0</span>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {["Reiki", "Tarô", "Constelação"].map((tag) => (
          <span
            key={tag}
            className="rounded-[8px] bg-brand-lavenderSoft px-3 py-2 text-[10px] font-extrabold text-brand-primary"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function CalendarPreview() {
  const days = Array.from({ length: 28 }, (_, index) => index + 1);

  return (
    <div className="mt-7 rounded-[16px] bg-white/90 p-4 shadow-card xl:p-5">
      <p className="text-center text-xs font-extrabold text-[#534c99]">
        Maio 2026
      </p>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-extrabold text-brand-deep sm:gap-2">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
        {days.map((day) => (
          <span
            key={day}
            className={cn(
              "grid aspect-square min-w-0 place-items-center rounded-full text-[10px] sm:size-7 sm:text-[11px]",
              day === 22
                ? "bg-brand-primary text-white"
                : "text-tesText-secondary",
            )}
          >
            {day}
          </span>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {["14:30 · Mariana S.", "16:00 · Ricardo L."].map((event) => (
          <div
            key={event}
            className="rounded-[10px] bg-brand-cyanSoft px-4 py-2 text-xs font-bold text-brand-deep"
          >
            {event}
          </div>
        ))}
      </div>
    </div>
  );
}

function GrowthPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mt-8 flex h-32 items-end gap-2.5 rounded-[18px] bg-white/70 p-4",
        className,
      )}
    >
      {[24, 38, 52, 66, 84].map((height, index) => (
        <div
          key={height}
          className="flex-1 rounded-t-[10px] bg-[linear-gradient(180deg,#AE94C3_0%,#6C3D91_100%)]"
          style={{ height: `${height}px`, opacity: 0.55 + index * 0.08 }}
        />
      ))}
    </div>
  );
}

function BentoCard({ card }: { card: (typeof benefitCards)[number] }) {
  const Icon = card.icon;
  const isRemote = card.variant === "remote";
  const isCalendar = card.variant === "calendar";
  const isCommunity = card.variant === "community";
  const isCompact = card.variant === "security" || card.variant === "payments";
  const isGrowth = card.variant === "growth";

  return (
    <article
      className={cn(
        "relative min-w-0 rounded-[18px] border border-[rgba(226,218,244,0.8)] p-7 shadow-card sm:p-8 xl:p-10",
        isRemote
          ? "flex flex-col overflow-hidden bg-[linear-gradient(135deg,#6C3D91_0%,#AE94C3_100%)] text-white lg:col-span-2 xl:col-span-1 xl:col-start-4 xl:row-span-3 xl:row-start-1"
          : "bg-white/88 text-brand-deep",
        isCalendar
          ? "bg-brand-cyanSoft/55 xl:col-start-2 xl:row-span-2 xl:row-start-1"
          : "",
        isCommunity
          ? "flex flex-col bg-brand-lavenderSoft xl:col-start-1 xl:row-start-3"
          : "",
        isCompact ? "xl:p-8" : "",
        card.variant === "profile"
          ? "lg:row-span-2 xl:col-start-1 xl:row-span-2 xl:row-start-1"
          : "",
        card.variant === "security" ? "xl:col-start-3 xl:row-start-1" : "",
        card.variant === "payments" ? "xl:col-start-3 xl:row-start-2" : "",
        isGrowth
          ? "lg:col-span-2 xl:col-span-2 xl:col-start-2 xl:row-start-3 xl:grid xl:grid-cols-[minmax(0,1.18fr)_minmax(180px,250px)] xl:items-center xl:gap-6"
          : "",
      )}
    >
      <div
        className={cn(
          "grid h-12 w-12 shrink-0 place-items-center rounded-full xl:h-14 xl:w-14",
          isRemote
            ? "bg-white/18 text-white"
            : "bg-brand-lavenderSoft text-brand-primary",
          isCommunity ? "bg-white/62" : "",
          isCompact ? "xl:h-12 xl:w-12" : "",
          isGrowth ? "xl:col-start-1 xl:row-start-1" : "",
        )}
      >
        <Icon
          className={cn("size-6 xl:size-7", isCompact ? "xl:size-6" : "")}
        />
      </div>
      <h3
        className={cn(
          "mt-5 font-display text-2xl font-light italic leading-tight xl:text-[28px]",
          isRemote ? "text-white xl:mt-auto xl:text-[40px]" : "text-brand-deep",
          isCompact ? "xl:text-[25px]" : "",
          isGrowth ? "xl:col-start-1 xl:row-start-2" : "",
        )}
      >
        {card.title}
      </h3>
      <p
        className={cn(
          "mt-4 text-sm font-semibold leading-6 xl:max-w-[230px]",
          isRemote
            ? "text-white/86 xl:text-base xl:leading-7"
            : "text-tesText-secondary",
          isCompact ? "xl:max-w-full xl:text-[13px] xl:leading-5" : "",
          isGrowth ? "xl:col-start-1 xl:row-start-3 xl:max-w-[380px]" : "",
        )}
      >
        {card.body}
      </p>

      {card.variant === "profile" ? <ProfilePreview /> : null}
      {card.variant === "calendar" ? <CalendarPreview /> : null}
      {isGrowth ? (
        <GrowthPreview className="xl:col-start-2 xl:row-span-3 xl:row-start-1 xl:mt-0 xl:h-40 xl:self-center" />
      ) : null}
      {card.variant === "community" ? (
        <div className="mt-auto flex items-center gap-1.5 pt-8 xl:gap-2">
          {[
            "/therapists/ana-oliveira.png",
            "/therapists/rafael-santos-avatar.png",
            "/therapists/celia-martins.png",
            "/therapists/juliana-costa.png",
          ].map((src) => (
            <div
              key={src}
              className="relative size-10 shrink-0 overflow-hidden rounded-full border-[3px] border-white shadow-card xl:size-10"
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="48px"
                className="object-cover"
              />
            </div>
          ))}
          <span className="ml-1 text-base font-extrabold text-brand-deep xl:text-lg">
            +300
          </span>
        </div>
      ) : null}
      {isRemote ? (
        <div className="relative mt-12 h-48 overflow-hidden rounded-[18px] border border-white/40 bg-white/10 xl:mt-auto xl:h-[330px]">
          <Image
            src="/for-therapists/session-preview.png"
            alt="Atendimento online pela plataforma"
            fill
            quality={95}
            sizes="320px"
            className="object-cover"
          />
        </div>
      ) : null}
    </article>
  );
}

function Benefits() {
  return (
    <section className="px-5 py-16 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1320px]">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-brand-deep md:text-4xl">
            Feito para quem cuida de pessoas
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base font-semibold leading-7 text-tesText-secondary">
            Tudo o que você precisa para organizar sua rotina, fortalecer sua
            presença e acompanhar sua jornada profissional.
          </p>
        </div>

        <div className="mt-10 grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,0.78fr)_minmax(0,1.15fr)] xl:grid-rows-[minmax(340px,auto)_minmax(340px,auto)_minmax(360px,auto)] xl:items-stretch">
          {benefitCards.map((card) => (
            <BentoCard key={card.title} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function ForTherapistsPage() {
  return (
    <main className="min-h-screen bg-white text-tesText-primary">
      <PublicHeader />
      <Hero />
      <Benefits />
      <PlansPreviewSection />
      <PublicFooter />
    </main>
  );
}
