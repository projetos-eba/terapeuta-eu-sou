import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  CircleDollarSign,
  CircleUserRound,
  Heart,
  Smile,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PublicFooter } from "@/components/tes/public-footer";
import { PublicHeader } from "@/components/tes/public-header";
import { TESButton } from "@/components/tes/tes-button";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Como funciona | Terapeuta Eu Sou",
  description:
    "Conheça como o Terapeuta Eu Sou reúne pessoas, terapeutas e ferramentas em uma experiência online, clara e acolhedora.",
};

type IconItem = {
  icon: LucideIcon;
  label: string;
};

const peopleJourney: IconItem[] = [
  { icon: Heart, label: "Descobrir práticas\ne possibilidades" },
  { icon: CircleUserRound, label: "Encontrar terapeutas\nque façam sentido" },
  { icon: CalendarDays, label: "Escolher e agendar\ncom facilidade" },
  { icon: Heart, label: "Acompanhar seus\natendimentos" },
  { icon: Smile, label: "Ter uma experiência\nmais leve e organizada" },
];

const therapistJourney: IconItem[] = [
  { icon: CircleUserRound, label: "Apresentar sua prática\ne seu propósito" },
  { icon: CalendarDays, label: "Organizar agenda\ne disponibilidade" },
  { icon: Video, label: "Realizar atendimentos\nde onde estiver" },
  { icon: CircleDollarSign, label: "Acompanhar pagamentos\ne recebimentos" },
  {
    icon: ChartNoAxesCombined,
    label: "Administrar sua rotina\nem um só lugar",
  },
];

const platformAreas: IconItem[] = [
  { icon: Heart, label: "Terapias" },
  { icon: CircleUserRound, label: "Terapeutas" },
  { icon: CalendarDays, label: "Agenda" },
  { icon: ChartNoAxesCombined, label: "Atendimentos" },
  { icon: CircleDollarSign, label: "Pagamentos" },
  { icon: CalendarDays, label: "Organização" },
];

export default function AboutUsPage() {
  return (
    <main className="overflow-hidden bg-surface-page text-tesText-primary">
      <PublicHeader />

      <section
        data-testid="about-hero"
        className="relative isolate overflow-hidden pb-20 pt-8 sm:pb-24 lg:pt-10 xl:min-h-[clamp(620px,36vw,900px)] xl:pb-24"
      >
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-[60px]">
          <div className="relative z-10 max-w-[760px] xl:max-w-[540px] xl:pr-5">
            <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-brand-primary/55">
              QUEM É O TES
            </p>
            <h1 className="mt-8 font-display text-[2rem] font-light italic leading-[1.06] tracking-[-0.025em] text-tesText-primary sm:text-[3.25rem] xl:text-[56px] xl:leading-[1.01]">
              <span className="block">Entre quem procura</span>
              <span className="block">um caminho e quem</span>
              <span className="block">dedica sua prática a&nbsp;ele,</span>
              <span className="mt-2 block font-bold italic text-brand-primary sm:bg-gradient-to-r sm:from-brand-primary sm:to-brand-cyan sm:bg-clip-text sm:text-transparent">
                existe um encontro.
              </span>
            </h1>
            <p className="mt-7 max-w-[35ch] text-[15px] font-medium leading-6 text-tesText-secondary sm:mt-9 sm:max-w-[390px] sm:text-base sm:leading-7">
              O TES — Terapeuta Eu Sou — é uma plataforma criada para tornar
              mais simples a jornada de quem busca terapias e também de quem
              vive&nbsp;delas.
            </p>
          </div>
        </div>

        <div className="relative mx-5 mt-8 aspect-[16/9] min-h-[300px] overflow-hidden sm:mx-8 sm:min-h-[390px] lg:mx-[60px] xl:absolute xl:inset-y-auto xl:left-[max(620px,calc((100vw-1440px)/2+620px))] xl:right-0 xl:top-0 xl:mx-0 xl:mt-0 xl:min-h-0">
          <Image
            src="/about/figma-02.png"
            alt="Duas mulheres em ambientes de cuidado e trabalho conectadas pelo Terapeuta Eu Sou"
            fill
            priority
            quality={95}
            sizes="(min-width: 1440px) calc(100vw - max(620px, calc((100vw - 1440px) / 2 + 620px))), (min-width: 1024px) calc(100vw - 620px), 100vw"
            className="object-cover object-center"
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 w-[10%] bg-gradient-to-r from-surface-page to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[16%] bg-gradient-to-t from-surface-page to-transparent" />
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pb-20 sm:px-8 lg:pb-24">
        <p className="text-center font-display text-[1.35rem] font-light italic leading-[1.1] tracking-[-0.01em] text-brand-primary sm:text-[1.7rem]">
          O TES OLHA PARA A JORNADA INTEIRA
        </p>

        <div className="mt-8 grid items-center gap-10 md:grid-cols-2 lg:grid-cols-[320px_minmax(0,1fr)_320px] lg:gap-8">
          <JourneyColumn items={peopleJourney} title="PARA PESSOAS" />

          <div className="order-first flex justify-center md:col-span-2 lg:order-none lg:col-span-1">
            <div className="relative aspect-square w-full max-w-[540px]">
              <Image
                src="/about/figma-11.png"
                alt="Ilustração TES representando o encontro entre pessoas e terapeutas"
                fill
                quality={95}
                sizes="(min-width: 1024px) 540px, 88vw"
                className="object-contain"
              />
            </div>
          </div>

          <JourneyColumn items={therapistJourney} title="PARA TERAPEUTAS" />
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pb-20 sm:px-8 lg:pb-24">
        <p className="mb-8 text-center text-sm font-extrabold uppercase tracking-[0.08em] text-brand-deep">
          UM TES. DUAS EXPERIÊNCIAS.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <ExperienceCard
            action="Quero encontrar meu caminho"
            body="Um ambiente para conhecer práticas, descobrir possibilidades e cuidar dos seus agendamentos em um só lugar."
            href={routes.public.journey}
            image="/about/figma-01.png"
            imageAlt="Pessoa escrevendo em um caderno em uma poltrona"
            title={
              <>
                Encontrar pode ser
                <br />
                mais simples.
              </>
            }
            variant="people"
          />
          <ExperienceCard
            action="Quero fazer parte do TES"
            body="Um espaço para apresentar sua prática e reunir agenda, atendimentos e organização."
            href={routes.public.forTherapists}
            image="/about/figma-04.png"
            imageAlt="Terapeuta trabalhando em seu computador"
            title={
              <>
                Trabalhar também pode
                <br />
                ser mais simples.
              </>
            }
            variant="therapists"
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-[1320px] items-center gap-10 px-5 pb-20 sm:px-8 md:grid-cols-2 lg:grid-cols-[minmax(260px,0.8fr)_minmax(380px,1.2fr)] lg:gap-8 lg:pb-24 xl:grid-cols-[minmax(260px,0.8fr)_minmax(420px,1.25fr)_minmax(330px,1fr)] xl:gap-6">
        <div className="max-w-[310px]">
          <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-brand-primary/55">
            TUDO ISSO EM UM SÓ LUGAR.
          </p>
          <h2 className="mt-7 font-display text-[clamp(2.25rem,9vw,2.75rem)] font-light italic leading-[1.1] tracking-[-0.025em] text-tesText-primary sm:text-[3rem]">
            Menos coisas espalhadas. Mais espaço para viver cada jornada.
          </h2>
        </div>

        <div className="relative aspect-[16/10] w-full sm:aspect-[4/3] md:col-span-2 lg:col-span-1">
          <Image
            src="/about/platform-dashboard-2026-08-26-transparent.png"
            alt="Plataforma Terapeuta Eu Sou em notebook e celular"
            fill
            quality={95}
            loading="eager"
            sizes="(min-width: 1024px) 560px, 92vw"
            className="object-contain"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[8%] bg-gradient-to-t from-surface-page to-transparent" />
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 md:col-span-2 xl:col-span-1 xl:gap-4">
          {platformAreas.map((item) => {
            const Icon = item.icon;

            return (
              <li
                key={item.label}
                className="flex min-h-14 min-w-0 items-center gap-3 rounded-full border border-border bg-surface-default px-6 text-sm font-bold text-tesText-primary sm:gap-4 sm:text-base"
              >
                <Icon
                  className="size-6 shrink-0"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
                {item.label}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pb-20 sm:px-8 lg:pb-24">
        <div className="rounded-panel border border-border bg-surface-default px-6 py-8 sm:px-10 lg:px-12">
          <p className="text-center text-sm font-extrabold uppercase tracking-[0.06em] text-brand-primary">
            O QUE A GENTE QUER CONSTRUIR VAI ALÉM DE UMA PLATAFORMA.
          </p>
          <div className="mt-8 grid divide-y divide-border lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            <ValueStatement icon={Heart}>
              Um lugar em que pessoas não precisem saber todas as respostas para
              começar.
            </ValueStatement>
            <ValueStatement icon={CircleUserRound}>
              Em que terapeutas tenham espaço para exercer sua prática sem
              perder sua autonomia.
            </ValueStatement>
            <ValueStatement icon={ChartNoAxesCombined}>
              E em que tecnologia organiza o que pode ser organizado, sem tirar
              o humano do centro.
            </ValueStatement>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pb-10 sm:px-8 lg:pb-14">
        <div className="relative isolate overflow-hidden rounded-hero bg-brand-deep text-tesText-inverse">
          <Image
            src="/about/figma-10.png"
            alt="Portal iluminado representando o encontro promovido pelo TES"
            fill
            quality={95}
            sizes="(min-width: 1024px) 1320px, 100vw"
            className="-z-20 object-cover object-center"
          />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-brand-deep via-brand-deep/55 to-transparent" />

          <div className="grid min-h-[440px] items-center gap-8 px-7 py-10 sm:px-12 sm:py-12 lg:min-h-[260px] lg:grid-cols-[390px_1fr] lg:px-12 lg:py-8">
            <h2 className="max-w-[390px] font-display text-[clamp(1.9rem,7.5vw,2.2rem)] font-light italic leading-[1.1] tracking-[-0.025em] text-tesText-inverse sm:text-[2.45rem]">
              Para quem busca.
              <br />
              Para quem atende.
              <br />
              Para tudo o que existe entre esses dois lados.
            </h2>
            <div className="max-w-[380px] lg:ml-12">
              <p className="text-lg font-medium leading-8 text-tesText-inverse sm:text-xl">
                O TES reúne pessoas, práticas, terapeutas e ferramentas em um
                mesmo espaço.
              </p>
              <TESButton
                href={routes.public.journey}
                variant="secondary"
                size="lg"
                className="mt-7 min-w-[260px] border-surface-default bg-surface-default text-brand-primary"
              >
                Conheça o TES
                <ArrowRight className="size-5" aria-hidden="true" />
              </TESButton>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

function JourneyColumn({ items, title }: { items: IconItem[]; title: string }) {
  return (
    <div>
      <p className="mb-6 flex min-h-10 w-full items-center justify-center rounded-full border border-border bg-surface-default px-5 text-sm font-extrabold tracking-[0.06em] text-brand-primary">
        {title}
      </p>
      <ul className="space-y-5">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <li key={item.label} className="flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-deep">
                <Icon
                  className="size-7"
                  strokeWidth={1.55}
                  aria-hidden="true"
                />
              </span>
              <span className="whitespace-pre-line text-base font-bold leading-6 text-tesText-primary">
                {item.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ExperienceCard({
  action,
  body,
  href,
  image,
  imageAlt,
  title,
  variant,
}: {
  action: string;
  body: string;
  href: string;
  image: string;
  imageAlt: string;
  title: ReactNode;
  variant: "people" | "therapists";
}) {
  const isPeople = variant === "people";

  return (
    <article className="grid overflow-hidden rounded-panel border border-border bg-surface-default p-4 sm:grid-cols-[minmax(180px,0.78fr)_minmax(0,1.22fr)] sm:gap-7 sm:p-5">
      <div className="relative aspect-[4/3] overflow-hidden rounded-card sm:aspect-auto sm:min-h-[255px]">
        <Image
          src={image}
          alt={imageAlt}
          fill
          quality={95}
          sizes="(min-width: 1024px) 290px, 92vw"
          className="object-cover"
        />
      </div>
      <div className="flex min-w-0 flex-col py-5 sm:py-2">
        <p
          className={`font-display text-[clamp(1.6rem,7vw,1.85rem)] font-light italic leading-none sm:text-[2rem] ${
            isPeople ? "text-brand-cyan" : "text-brand-primary"
          }`}
        >
          {isPeople ? "Para quem busca" : "Para terapeutas"}
        </p>
        <h3 className="mt-4 font-display text-[clamp(2rem,8.5vw,2.35rem)] font-light italic leading-[1.08] tracking-[-0.02em] text-tesText-primary">
          {title}
        </h3>
        <p className="mt-5 text-sm font-medium leading-6 text-tesText-secondary">
          {body}
        </p>
        <TESButton
          href={href}
          size="md"
          className={`mt-auto w-full justify-between sm:mt-6 ${
            isPeople
              ? "bg-brand-cyan text-tesText-inverse hover:bg-brand-cyan"
              : ""
          }`}
        >
          {action}
          <ArrowRight className="size-4" aria-hidden="true" />
        </TESButton>
      </div>
    </article>
  );
}

function ValueStatement({
  children,
  icon: Icon,
}: {
  children: ReactNode;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-start gap-5 py-7 first:pt-0 last:pb-0 lg:px-9 lg:py-0 lg:first:pl-0 lg:last:pr-0">
      <span className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-deep">
        <Icon className="size-7" strokeWidth={1.55} aria-hidden="true" />
      </span>
      <p className="max-w-[290px] text-base font-bold leading-7 text-tesText-primary">
        {children}
      </p>
    </div>
  );
}
