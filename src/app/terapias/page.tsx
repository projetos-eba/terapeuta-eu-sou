import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";

import {
  PublicFooter,
  PublicHeader,
  TESButton,
  TESDecorativeMedia,
} from "@/components/tes";
import {
  ThemeFilter,
  TherapyFilters,
  TherapyGrid,
  getPublicTherapiesFromSearchParams,
} from "@/features/therapies";
import { routes } from "@/lib/routes";
import { platformAssets } from "@/lib/platform-assets";

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
      "Explore terapias publicadas, filtre por temas e siga para profissionais relacionados.",
    url: routes.public.therapies,
    type: "website",
  },
};

type TherapiesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TherapiesPage({
  searchParams,
}: TherapiesPageProps) {
  const queryParams = await searchParams;
  if (queryParams?.category) {
    const legacy = new URLSearchParams();
    for (const key of ["q", "sort", "page", "pageSize"]) {
      const value = queryParams[key];
      const first = Array.isArray(value) ? value[0] : value;
      if (first) legacy.set(key, first);
    }
    const suffix = legacy.toString();
    redirect(suffix ? `${routes.public.therapies}?${suffix}` : routes.public.therapies);
  }
  const { params, result } =
    await getPublicTherapiesFromSearchParams(queryParams);

  return (
    <main className="min-h-screen bg-white text-brand-deep">
      <PublicHeader />

      <section className="relative isolate overflow-hidden bg-[linear-gradient(90deg,#ffffff_0%,#ffffff_55%,#F1E8F6_100%)]">
        <div className="mx-auto grid min-h-[410px] max-w-[1440px] items-center gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[minmax(0,0.46fr)_minmax(0,0.54fr)] lg:px-[68px] lg:py-0">
          <div className="relative z-10 max-w-[650px]">
            <h1 className="font-display text-[3.15rem] font-light italic leading-[1.08] text-brand-deep sm:text-[3.5rem]">
              Conheça os caminhos terapêuticos disponíveis
            </h1>
            <p className="mt-5 max-w-[625px] text-lg font-bold leading-8 text-tesText-secondary sm:text-xl">
              Connheça diferentes práticas e descubra quais fazem sentido para o
              momento que você está vivendo.
            </p>

            <form
              action={routes.public.therapies}
              className="mt-7 flex min-h-16 max-w-[610px] items-center gap-4 rounded-[14px] border border-brand-lavender bg-white px-5 shadow-[0_8px_22px_rgba(46,26,71,0.05)]"
            >
              <Search className="h-[30px] w-[30px] shrink-0 text-brand-primary" />
              <label className="sr-only" htmlFor="therapy-search">
                Buscar terapia
              </label>
              <input
                id="therapy-search"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Busque por uma terapia"
                className="min-h-12 flex-1 bg-transparent text-base font-bold text-brand-deep outline-none placeholder:text-tesText-muted sm:text-lg"
              />
              {params.theme ? (
                <input type="hidden" name="theme" value={params.theme} />
              ) : null}
              {params.sort !== "relevance" ? (
                <input type="hidden" name="sort" value={params.sort} />
              ) : null}
              <button type="submit" className="sr-only">
                Buscar
              </button>
            </form>
          </div>

          <div className="relative hidden min-h-[430px] lg:block">
            <TESDecorativeMedia
              className="absolute inset-0"
              fade="left"
              imageClassName="object-right"
              objectPosition="right center"
              priority
              quality={95}
              sizes="(min-width: 1024px) 765px, 100vw"
              src={platformAssets.publicTherapiesHero.src}
            />
          </div>
        </div>
      </section>

      <TherapyFilters params={params} totalCount={result.totalCount} />

      <section className="bg-[#FBF8FF] pb-16">
        <div className="mx-auto grid max-w-[1440px] gap-6 px-5 sm:px-8 lg:grid-cols-[minmax(0,285px)_minmax(0,1fr)] lg:px-[68px]">
          <div className="min-w-0 space-y-5">
            <ThemeFilter
              activeTheme={params.theme}
              themes={result.themes}
              params={params}
              totalCount={result.totalCount}
            />

            <aside className="hidden overflow-hidden rounded-[14px] border border-brand-lavender/80 bg-white shadow-[0_12px_28px_rgba(46,26,71,0.07)] lg:block">
              <div className="p-6 pb-0">
                <h2 className="font-display text-[1.62rem] font-light italic leading-tight text-brand-deep">
                  Não encontrou o que procura?
                </h2>
                <p className="mt-4 text-[0.78rem] font-semibold leading-5 text-tesText-secondary">
                  Faça nossa jornada guiada e descubra caminhos que podem
                  conversar com o seu momento.
                </p>
                <TESButton
                  href={routes.public.journey}
                  className="mt-5 min-h-10 w-full rounded-[8px] text-xs"
                >
                  Fazer minha jornada
                  <ArrowRight className="h-3.5 w-3.5" />
                </TESButton>
              </div>
              <div className="relative mt-2 h-[128px]">
                <TESDecorativeMedia
                  className="absolute inset-0"
                  fade="none"
                  imageClassName="object-contain object-bottom"
                  quality={95}
                  sizes="285px"
                  src={platformAssets.publicTherapiesCard.src}
                />
              </div>
            </aside>
          </div>

          <div>
            <TherapyGrid params={params} result={result} />
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
