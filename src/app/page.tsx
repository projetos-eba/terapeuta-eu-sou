import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import {
  ArrowRight,
  CalendarDays,
  Heart,
  Leaf,
  MessageCircleQuestion,
  ShieldCheck,
  Sparkles,
  Star,
  Video,
} from "lucide-react";

import {
  PublicFooter,
  PublicHeader,
  TESBadge,
  TESButton,
  TESCard,
} from "@/components/tes";
import {
  getPublicHomeData,
  homeFaqs,
  homeHero,
  homeIntroCards,
  homeReasons,
  homeSteps,
} from "@/features/public-home";
import type {
  PublicHomeReason,
  PublicHomeTestimonial,
  PublicHomeTherapist,
  PublicHomeTherapy,
} from "@/features/public-home";
import { routes } from "@/lib/routes";

export const revalidate = 900;

const reasonToneClasses: Record<PublicHomeReason["tone"], string> = {
  blue: "border-[#8BB8EF] text-[#3F84B4]",
  green: "border-[#8ED6B2] text-[#2FAE78]",
  orange: "border-[#F2C17F] text-[#E78120]",
  pink: "border-[#F1A8CB] text-[#C73682]",
  purple: "border-brand-lavender text-brand-primary",
};

function SectionHeading({
  eyebrow,
  title,
  body,
  centered = true,
}: {
  body?: string;
  centered?: boolean;
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {eyebrow ? (
        <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-primary">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-display text-4xl font-light italic leading-tight text-brand-deep md:text-5xl">
        {title}
      </h2>
      {body ? (
        <p className="mt-4 text-base font-semibold leading-7 text-tesText-secondary md:text-lg">
          {body}
        </p>
      ) : null}
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative mx-auto grid max-w-[1680px] gap-10 px-5 pb-16 pt-4 sm:px-8 lg:min-h-[690px] lg:grid-cols-[minmax(0,0.82fr)_minmax(560px,1fr)] lg:px-12">
      <div className="relative z-10 flex max-w-2xl flex-col justify-center py-10 lg:py-20">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-primary">
          {homeHero.eyebrow}
        </p>
        <h1 className="mt-5 font-display text-5xl font-light italic leading-[1.05] text-[#17116f] md:text-7xl">
          {homeHero.titleStart}
          <span className="mt-2 block bg-[linear-gradient(90deg,#6C3D91_0%,#81BAE0_100%)] bg-clip-text font-semibold text-transparent">
            {homeHero.titleAccent}
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-base font-semibold leading-8 text-tesText-secondary md:text-lg">
          {homeHero.body}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <TESButton href={homeHero.primaryCta.href} size="lg">
            {homeHero.primaryCta.label}
          </TESButton>
          <TESButton
            href={homeHero.secondaryCta.href}
            size="lg"
            variant="secondary"
          >
            {homeHero.secondaryCta.label}
          </TESButton>
        </div>
      </div>

      <div className="relative min-h-[360px] overflow-hidden rounded-hero lg:absolute lg:inset-y-0 lg:right-0 lg:w-[70%] lg:rounded-none">
        <Image
          src="/home/hero-section-realistic-fade.png"
          alt="Cena acolhedora de conversa terapeutica em ambiente calmo"
          fill
          priority
          sizes="(min-width: 1024px) 70vw, 100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-y-0 left-0 hidden w-[42%] bg-gradient-to-r from-[#FCFAFF] via-[#FCFAFF]/90 to-[#FCFAFF]/0 lg:block" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#FCFAFF] to-[#FCFAFF]/0" />
      </div>
    </section>
  );
}

function IntroSection() {
  return (
    <section className="mx-auto grid max-w-[1680px] gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-12">
      <div>
        <SectionHeading
          centered={false}
          eyebrow="O que e o TES?"
          title="Um espaco para quem busca novos caminhos"
          body="Reunimos informacao, perfis publicos e uma jornada guiada para ajudar voce a encontrar praticas e profissionais com mais clareza."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {homeIntroCards.map((card) => (
          <TESCard key={card.title} className="p-5 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
              <Heart className="size-6" />
            </span>
            <h3 className="mt-4 text-base font-extrabold text-brand-deep">
              {card.title}
            </h3>
            <p className="mt-2 text-xs font-semibold leading-5 text-tesText-muted">
              {card.body}
            </p>
          </TESCard>
        ))}
      </div>
    </section>
  );
}

function StepsSection() {
  return (
    <section className="mx-auto max-w-[1680px] px-5 py-16 sm:px-8 lg:px-12">
      <SectionHeading
        title="Como funciona"
        body="Quatro passos simples para voce iniciar sua jornada com calma."
      />

      <ol className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {homeSteps.map((step, index) => (
          <li key={step.title} className="relative">
            <TESCard className="h-full overflow-hidden p-6">
              <div className="relative h-32">
                <Image
                  src={step.image}
                  alt=""
                  fill
                  sizes="260px"
                  className="object-contain"
                />
                <span className="absolute left-0 top-0 grid size-12 place-items-center rounded-full bg-[#EEE6FF] text-lg font-extrabold text-brand-primary">
                  {index + 1}
                </span>
              </div>
              <h3 className="mt-5 font-display text-2xl font-light italic leading-tight text-brand-deep">
                {step.title}
              </h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
                {step.body}
              </p>
            </TESCard>
            {index < homeSteps.length - 1 ? (
              <span className="absolute -right-4 top-1/2 z-10 hidden text-2xl font-extrabold text-brand-primary xl:block">
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function TherapyMarquee({ therapies }: { therapies: PublicHomeTherapy[] }) {
  return (
    <section className="bg-brand-lavenderSoft py-4">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-3 px-5 sm:px-8 lg:px-12">
        <p className="mr-4 max-w-[180px] text-xs font-extrabold leading-5 text-brand-primary">
          Diferentes caminhos. Uma unica busca.
        </p>
        {therapies.map((therapy) => (
          <Link
            key={therapy.slug}
            href={therapy.href as Route}
            className="rounded-full border border-border bg-white px-4 py-2 text-xs font-extrabold text-brand-primary shadow-card transition hover:-translate-y-0.5 hover:border-brand-lavender"
          >
            {therapy.name}
          </Link>
        ))}
      </div>
    </section>
  );
}

function ReasonsSection() {
  return (
    <section className="mx-auto max-w-[1680px] px-5 py-20 sm:px-8 lg:px-12">
      <SectionHeading
        title="Cada pessoa chega por um motivo diferente..."
        body="Qual a sua motivacao hoje?"
      />

      <div className="mt-12 grid items-center gap-6 lg:grid-cols-[280px_minmax(0,1fr)_280px]">
        <div className="grid gap-6">
          {homeReasons.slice(0, 2).map((reason) => (
            <ReasonCard key={reason.title} reason={reason} />
          ))}
        </div>

        <div className="relative mx-auto aspect-[770/515] w-full max-w-3xl">
          <Image
            src="/home/tablet-video-session.png"
            alt="Sessao online em tablet"
            fill
            sizes="(min-width: 1024px) 52vw, 100vw"
            className="object-contain drop-shadow-2xl"
          />
        </div>

        <div className="grid gap-6">
          {homeReasons.slice(2, 4).map((reason) => (
            <ReasonCard key={reason.title} reason={reason} />
          ))}
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-xs">
        <ReasonCard reason={homeReasons[4]} />
      </div>
    </section>
  );
}

function ReasonCard({ reason }: { reason: PublicHomeReason }) {
  return (
    <TESCard
      className={`border-2 bg-white/80 p-6 text-center ${reasonToneClasses[reason.tone]}`}
    >
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-white shadow-card">
        <Sparkles className="size-5" />
      </span>
      <h3 className="mt-4 font-display text-3xl font-light italic">
        {reason.title}
      </h3>
      <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
        {reason.body}
      </p>
    </TESCard>
  );
}

function FeaturedTherapists({
  therapists,
}: {
  therapists: PublicHomeTherapist[];
}) {
  return (
    <section className="mx-auto max-w-[1680px] px-5 py-16 sm:px-8 lg:px-12">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <SectionHeading
          centered={false}
          eyebrow="Terapeutas em destaque"
          title="Profissionais verificados para voce conhecer com calma"
        />
        <TESButton href={routes.public.therapists} variant="secondary">
          Ver todos os terapeutas
          <ArrowRight className="size-4" />
        </TESButton>
      </div>

      <div className="mt-9 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {therapists.map((therapist) => (
          <TherapistPreview key={therapist.slug} therapist={therapist} />
        ))}
      </div>
    </section>
  );
}

function TherapistPreview({ therapist }: { therapist: PublicHomeTherapist }) {
  return (
    <TESCard className="overflow-hidden p-3">
      <div className="relative h-56 overflow-hidden rounded-[16px] bg-surface-soft">
        <Image
          src={therapist.photoUrl}
          alt={`Retrato de ${therapist.name}`}
          fill
          loading="eager"
          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-3">
          <TESBadge tone="brand">
            <ShieldCheck className="size-3" />
            Perfil verificado
          </TESBadge>
          <span className="flex items-center gap-1 text-sm font-extrabold text-brand-deep">
            {therapist.ratingLabel}
            <Star className="size-4 fill-[#F4B84A] text-[#F4B84A]" />
          </span>
        </div>
        <h3 className="mt-4 text-xl font-extrabold text-brand-deep">
          {therapist.name}
        </h3>
        <p className="mt-1 text-sm font-extrabold text-brand-primary">
          {therapist.headline}
        </p>
        <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
          {therapist.serviceTitle}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3 text-xs font-bold text-tesText-muted">
          <span>{therapist.reviewCountLabel}</span>
          <span>{therapist.priceLabel}</span>
        </div>
        <Link
          href={therapist.href as Route}
          className="mt-5 flex h-11 items-center justify-center rounded-full bg-brand-primary px-4 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover"
        >
          Ver perfil completo
        </Link>
      </div>
    </TESCard>
  );
}

function TherapySection({ therapies }: { therapies: PublicHomeTherapy[] }) {
  return (
    <section className="mx-auto max-w-[1680px] px-5 py-16 sm:px-8 lg:px-12">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <SectionHeading
          centered={false}
          eyebrow="Caminhos terapeuticos"
          title="Explore praticas antes de escolher"
          body="As descricoes sao informativas e nao prometem cura, diagnostico ou resultado."
        />
        <TESButton href={routes.public.therapies} variant="secondary">
          Ver catalogo
          <ArrowRight className="size-4" />
        </TESButton>
      </div>

      <div className="mt-9 grid gap-5 md:grid-cols-3">
        {therapies.slice(0, 3).map((therapy) => (
          <TESCard key={therapy.slug} className="p-6">
            <div className="flex items-center justify-between gap-4">
              <span className="grid size-12 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
                <Leaf className="size-6" />
              </span>
              {therapy.isFeatured ? (
                <TESBadge tone="brand">Destaque TES</TESBadge>
              ) : null}
            </div>
            <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.14em] text-brand-primary">
              {therapy.categoryName}
            </p>
            <h3 className="mt-2 font-display text-3xl font-light italic text-brand-deep">
              {therapy.name}
            </h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
              {therapy.shortDescription}
            </p>
            <Link
              href={therapy.href as Route}
              className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-brand-primary"
            >
              Conhecer terapia
              <ArrowRight className="size-4" />
            </Link>
          </TESCard>
        ))}
      </div>
    </section>
  );
}

function TestimonialsSection({
  testimonials,
}: {
  testimonials: PublicHomeTestimonial[];
}) {
  return (
    <section className="mx-auto max-w-[1680px] px-5 py-16 sm:px-8 lg:px-12">
      <SectionHeading
        eyebrow="Historias reais"
        title="Experiencias compartilhadas por quem ja passou por aqui"
      />

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {testimonials.map((testimonial) => (
          <TESCard
            key={`${testimonial.author}-${testimonial.context}`}
            className="p-6"
          >
            <div className="flex items-center gap-1 text-[#F4B84A]">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} className="size-4 fill-current" />
              ))}
              <span className="ml-2 text-sm font-extrabold text-brand-deep">
                {testimonial.ratingLabel}
              </span>
            </div>
            <p className="mt-6 text-sm font-semibold leading-7 text-tesText-secondary">
              &quot;{testimonial.body}&quot;
            </p>
            <div className="mt-8 border-t border-border pt-4">
              <p className="font-extrabold text-brand-deep">
                {testimonial.author}
              </p>
              <p className="text-sm font-semibold text-tesText-muted">
                {testimonial.context}
              </p>
            </div>
          </TESCard>
        ))}
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="mx-auto max-w-[1680px] px-5 py-16 sm:px-8 lg:px-12">
      <SectionHeading
        eyebrow="Duvidas frequentes"
        title="Como podemos te ajudar?"
      />

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {homeFaqs.map((faq) => (
          <details
            key={faq.question}
            className="group rounded-card border border-border bg-white p-5 shadow-card"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-extrabold text-brand-deep">
              <span>{faq.question}</span>
              <MessageCircleQuestion className="size-5 text-brand-primary transition group-open:rotate-12" />
            </summary>
            <p className="mt-4 text-sm font-semibold leading-6 text-tesText-secondary">
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

function JourneyCta() {
  return (
    <section className="mx-auto max-w-[1680px] px-5 py-10 sm:px-8 lg:px-12">
      <div className="grid gap-8 overflow-hidden rounded-hero border border-border bg-[linear-gradient(135deg,#6C3D91_0%,#5B337A_56%,#81BAE0_140%)] p-8 text-white shadow-soft md:grid-cols-[1fr_auto] md:items-center md:p-10">
        <div>
          <TESBadge tone="soft" className="bg-white/15 text-white">
            <Video className="size-3" />
            Sessao online
          </TESBadge>
          <h2 className="mt-4 font-display text-4xl font-light italic leading-tight md:text-5xl">
            Comece pela sua jornada
          </h2>
          <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-white/80">
            Responda algumas perguntas e veja caminhos que podem fazer sentido
            para o momento que voce esta vivendo.
          </p>
        </div>
        <TESButton
          href={routes.public.journey}
          size="lg"
          variant="secondary"
          className="bg-white"
        >
          Comecar minha jornada
          <CalendarDays className="size-4" />
        </TESButton>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const data = await getPublicHomeData();

  return (
    <main className="min-h-screen overflow-hidden bg-[#FCFAFF] text-tesText-primary">
      <PublicHeader />
      <HeroSection />
      <IntroSection />
      <StepsSection />
      <TherapyMarquee therapies={data.therapies} />
      <ReasonsSection />
      <TherapySection therapies={data.therapies} />
      <FeaturedTherapists therapists={data.therapists} />
      <TestimonialsSection testimonials={data.testimonials} />
      <JourneyCta />
      <FaqSection />
      <PublicFooter />
    </main>
  );
}
