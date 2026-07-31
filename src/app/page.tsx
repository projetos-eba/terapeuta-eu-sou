import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import {
  ArrowRight,
  CalendarDays,
  Heart,
  MessageCircleQuestion,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Star,
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
import { FeaturedTherapistsCarousel } from "@/features/public-home/components/featured-therapists-carousel";
import type {
  PublicHomeReason,
  PublicHomeTestimonial,
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

const introIcons = [Heart, Sparkles, ShieldCheck, SearchCheck];

const therapyImages: Record<string, string> = {
  "constelacao-familiar": "/therapies/constelacao-familiar-editorial.png",
  reiki: "/therapies/reiki-editorial.png",
  taro: "/therapies/taro-editorial.png",
};

function getTherapyImage(therapy: PublicHomeTherapy) {
  return therapy.imageUrl || therapyImages[therapy.slug] || "/therapies/hero-therapies.png";
}

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
    <section className="relative pb-16 pt-4 lg:min-h-[680px]">
      <div className="relative z-10 mx-auto grid max-w-[1680px] gap-10 px-5 sm:px-8 lg:min-h-[680px] lg:grid-cols-[minmax(430px,0.42fr)_minmax(0,0.58fr)] lg:px-12">
        <div className="flex max-w-2xl flex-col justify-center py-10 lg:py-20">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-primary">
            {homeHero.eyebrow}
          </p>
          <h1 className="mt-5 font-display text-5xl font-light italic leading-[1.05] text-brand-deep md:text-7xl">
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
      </div>

      <div className="pointer-events-none relative mx-5 min-h-[360px] overflow-hidden rounded-hero sm:mx-8 lg:absolute lg:inset-y-0 lg:left-[34vw] lg:right-0 lg:mx-0 lg:rounded-none">
        <Image
          src="/home/hero-section-realistic-fade.png"
          alt="Cena acolhedora de conversa terapeutica em ambiente calmo"
          fill
          priority
          sizes="(min-width: 1024px) 66vw, 100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-y-0 left-0 hidden w-[38%] bg-gradient-to-r from-[#FCFAFF] via-[#FCFAFF]/88 to-[#FCFAFF]/0 lg:block" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#FCFAFF] to-[#FCFAFF]/0" />
      </div>
    </section>
  );
}

function IntroSection() {
  return (
    <section className="relative overflow-hidden py-12 lg:py-16">
      <div className="pointer-events-none absolute right-0 top-[90px] hidden h-[286px] rounded-l-[38px] bg-brand-primary lg:left-[635px] lg:block 2xl:left-[735px]" />
      <div className="relative mx-auto grid max-w-[1680px] gap-9 px-5 sm:px-8 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start lg:px-12">
        <div className="relative z-10 lg:pt-4">
          <SectionHeading
            centered={false}
            eyebrow="O que e o TES?"
            title="Um espaco para quem busca novos caminhos"
            body="Reunimos informacao, perfis publicos e uma jornada guiada para ajudar voce a encontrar praticas e profissionais com mais clareza."
          />
        </div>
        <div className="relative min-h-[312px] lg:min-h-[292px]">
          <div className="relative z-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:pl-[106px] lg:pr-4 xl:gap-5">
            {homeIntroCards.map((card, index) => {
              const Icon = introIcons[index] ?? Heart;

              return (
                <TESCard
                  key={card.title}
                  className="min-h-[236px] rounded-[16px] border-[#E0D6F0] p-5 text-center shadow-soft lg:min-h-[260px]"
                >
                  <span className="mx-auto grid size-[78px] place-items-center rounded-full bg-[#EDE3F5] text-brand-primary">
                    <Icon className="size-[40px]" strokeWidth={1.8} />
                  </span>
                  <h3 className="mt-5 text-[0.95rem] font-extrabold leading-normal text-brand-deep">
                    {card.title}
                  </h3>
                  <p className="mt-3 text-[0.8rem] font-medium leading-5 text-tesText-muted">
                    {card.body}
                  </p>
                </TESCard>
              );
            })}
          </div>
        </div>
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
              <div className="relative h-44 sm:h-48 xl:h-52">
                <Image
                  src={step.image}
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 330px, (min-width: 768px) 45vw, 100vw"
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
    <section className="relative mx-auto max-w-[1680px] px-5 py-20 sm:px-8 lg:px-12">
      <SectionHeading
        title="Cada pessoa chega por um motivo diferente..."
        body="Escolha o ponto de partida que conversa com o seu momento, sem pressa."
      />

      <div className="pointer-events-none absolute left-1/2 top-[42%] hidden h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-brand-lavenderSoft/70 blur-3xl lg:block" />

      <div className="relative mt-12 grid items-center gap-6 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
        <div className="grid gap-6">
          {homeReasons.slice(0, 2).map((reason) => (
            <ReasonCard key={reason.title} reason={reason} />
          ))}
        </div>

        <div className="relative order-first mx-auto aspect-[770/515] w-full max-w-4xl lg:order-none">
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
      className={`border-2 bg-white/90 p-6 text-center shadow-soft backdrop-blur ${reasonToneClasses[reason.tone]}`}
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
          <TESCard key={therapy.slug} className="overflow-hidden p-0">
            <div className="relative h-40 bg-surface-soft">
              <Image
                src={getTherapyImage(therapy)}
                alt={`Imagem editorial de ${therapy.name}`}
                fill
                sizes="(min-width: 768px) 30vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/30 to-transparent" />
              {therapy.isFeatured ? (
                <TESBadge tone="brand" className="absolute right-4 top-4">
                  Destaque TES
                </TESBadge>
              ) : null}
            </div>
            <div className="p-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-primary">
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
            </div>
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
        {testimonials.map((testimonial, testimonialIndex) => (
          <TESCard
            key={`${testimonial.author}-${testimonial.context}-${testimonialIndex}`}
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
      <div className="relative overflow-hidden rounded-hero border border-border bg-brand-primary p-8 text-white shadow-soft md:min-h-[310px] md:p-12">
        <Image
          src="/home/match-journey-banner.png"
          alt=""
          fill
          sizes="(min-width: 1024px) 90vw, 100vw"
          className="object-cover object-[62%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-primary via-brand-primary/82 to-brand-primary/10" />
        <div className="relative max-w-2xl">
          <h2 className="font-display text-4xl font-light italic leading-tight md:text-5xl">
            Comece pela sua jornada
          </h2>
          <p className="mt-4 max-w-xl text-base font-semibold leading-7 text-white/85">
            Responda algumas perguntas com calma e veja caminhos terapeuticos
            que podem conversar com o seu momento.
          </p>
          <TESButton
            href={routes.public.journey}
            size="lg"
            variant="secondary"
            className="mt-7 bg-white"
          >
            Comecar minha jornada
            <CalendarDays className="size-4" />
          </TESButton>
        </div>
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
      <FeaturedTherapistsCarousel therapists={data.therapists} />
      <TestimonialsSection testimonials={data.testimonials} />
      <JourneyCta />
      <FaqSection />
      <PublicFooter />
    </main>
  );
}
