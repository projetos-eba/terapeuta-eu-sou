import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, Search, Sparkles } from "lucide-react";

import { PublicFooter, PublicHeader, TESButton } from "@/components/tes";
import {
  CategoryFilter,
  TherapyFilters,
  TherapyGrid,
  getPublicTherapiesFromSearchParams,
} from "@/features/therapies";
import { routes } from "@/lib/routes";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Terapias | Terapeuta Eu Sou",
  description:
    "Conheça o catálogo público de terapias do Terapeuta Eu Sou e encontre caminhos para seguir com profissionais compatíveis.",
  alternates: {
    canonical: routes.public.therapies,
  },
  openGraph: {
    title: "Terapias | Terapeuta Eu Sou",
    description:
      "Explore terapias publicadas, filtre por categoria e siga para profissionais relacionados.",
    url: routes.public.therapies,
    type: "website",
  },
};

type TherapiesPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function TherapiesPage({
  searchParams,
}: TherapiesPageProps) {
  const { params, result } = await getPublicTherapiesFromSearchParams(
    searchParams,
  );

  return (
    <main className="min-h-screen bg-[#fbf8ff] text-brand-deep">
      <PublicHeader />

      <section className="relative isolate overflow-hidden bg-[linear-gradient(110deg,#fbf8ff_0%,#ffffff_58%,#f1e8f6_100%)]">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_20%,rgba(226,209,236,0.58),transparent_34%),radial-gradient(circle_at_85%_18%,rgba(129,186,224,0.18),transparent_28%)]" />
        <div className="mx-auto grid min-h-[410px] max-w-[1440px] items-center gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[1fr_0.92fr] lg:py-0">
          <div className="relative z-10 max-w-[690px]">
            <p className="text-sm font-extrabold uppercase tracking-[0.26em] text-brand-primary">
              Catálogo de terapias
            </p>
            <h1 className="mt-5 max-w-[760px] text-[54px] font-semibold italic leading-[0.96] text-brand-deep sm:text-[76px] lg:text-[94px]">
              Encontre práticas para o seu momento.
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-text-secondary">
              Explore abordagens publicadas pela plataforma, entenda cada
              caminho e siga para profissionais relacionados quando fizer
              sentido para você.
            </p>

            <form
              action={routes.public.therapies}
              className="mt-8 flex min-h-16 max-w-[610px] items-center gap-3 rounded-full border border-brand-lavender bg-white px-5 shadow-[0_18px_44px_rgba(38,20,51,0.10)]"
            >
              <Search className="h-5 w-5 shrink-0 text-brand-primary" />
              <label className="sr-only" htmlFor="therapy-search">
                Buscar terapia
              </label>
              <input
                id="therapy-search"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Busque por Reiki, ansiedade, energia..."
                className="min-h-12 flex-1 bg-transparent text-base font-bold text-brand-deep outline-none placeholder:text-text-muted"
              />
              {params.category ? (
                <input type="hidden" name="category" value={params.category} />
              ) : null}
              {params.sort !== "relevance" ? (
                <input type="hidden" name="sort" value={params.sort} />
              ) : null}
              <button
                type="submit"
                className="hidden min-h-12 rounded-full bg-brand-primary px-6 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus:outline-none focus:ring-4 focus:ring-ring/20 sm:inline-flex sm:items-center"
              >
                Buscar
              </button>
            </form>
          </div>

          <div className="relative hidden min-h-[410px] lg:block">
            <Image
              src="/therapies/hero-therapies.png"
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 765px, 100vw"
              className="object-contain object-right-bottom"
            />
          </div>
        </div>
      </section>

      <TherapyFilters params={params} totalCount={result.totalCount} />

      <section className="mx-auto grid max-w-[1320px] gap-7 px-5 py-12 sm:px-8 lg:grid-cols-[285px_1fr] lg:py-16">
        <div className="space-y-5">
          <CategoryFilter
            activeCategory={params.category}
            categories={result.categories}
            params={params}
            totalCount={result.totalCount}
          />

          <aside className="hidden overflow-hidden rounded-[30px] border border-brand-lavender/80 bg-white shadow-[0_18px_48px_rgba(38,20,51,0.08)] lg:block">
            <div className="relative h-[160px]">
              <Image
                src="/therapies/journey-side.png"
                alt=""
                fill
                sizes="285px"
                className="object-cover"
              />
            </div>
            <div className="p-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-lavenderSoft px-3 py-1 text-xs font-extrabold text-brand-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Jornada guiada
              </span>
              <h2 className="mt-4 text-3xl font-semibold italic leading-tight text-brand-deep">
                Ainda não sabe por onde começar?
              </h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-text-secondary">
                Responda temas e interesses para conhecer terapias que podem
                combinar com o seu momento.
              </p>
              <TESButton
                href={routes.public.journey}
                className="mt-5 w-full"
                variant="gradient"
              >
                Fazer jornada
              </TESButton>
            </div>
          </aside>
        </div>

        <div>
          <TherapyGrid params={params} result={result} />

          <section className="relative mt-14 overflow-hidden rounded-[34px] bg-brand-primary text-white shadow-[0_22px_64px_rgba(38,20,51,0.16)]">
            <Image
              src="/therapies/journey-banner.png"
              alt=""
              fill
              sizes="(min-width: 1024px) 1046px, 100vw"
              className="object-cover opacity-28"
            />
            <div className="relative z-10 flex flex-col gap-6 p-7 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-white/78">
                  Sua jornada
                </p>
                <h2 className="mt-3 text-4xl font-semibold italic leading-tight sm:text-5xl">
                  Descubra caminhos com uma seleção guiada.
                </h2>
                <p className="mt-4 text-base font-semibold leading-7 text-white/82">
                  O match recomenda terapias de forma anônima e determinística,
                  sem usar avaliações, agenda ou plano de terapeutas.
                </p>
              </div>
              <TESButton
                href={routes.public.journey}
                variant="secondary"
                className="min-h-14 shrink-0 border-white/50 bg-white text-brand-primary"
              >
                Ver minha jornada
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </TESButton>
            </div>
          </section>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
