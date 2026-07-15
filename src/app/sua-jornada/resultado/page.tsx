import type { Metadata } from "next";

import { PublicFooter, PublicHeader } from "@/components/tes";
import { MatchingResultClient } from "@/features/public-matching/components/result-client";

export const metadata: Metadata = {
  description:
    "Resultado anônimo da jornada com caminhos terapêuticos sugeridos pelo Match TES.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Resultado da Jornada | Terapeuta Eu Sou",
};

export default function JourneyResultPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#FFFFFF_0%,#F8F5FF_48%,#FFFFFF_100%)] text-tesText-primary">
      <PublicHeader />
      <section className="mx-auto max-w-[1180px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-brand-primary">
            Resultado da jornada
          </p>
          <h1 className="mt-4 font-display text-5xl font-light italic leading-tight text-brand-deep md:text-6xl">
            Caminhos que podem conversar com seu momento
          </h1>
          <p className="mt-4 text-base font-semibold leading-7 text-tesText-secondary">
            Veja terapias sugeridas pelo Match determinístico do TES e conheça
            cada caminho no seu tempo.
          </p>
        </div>
        <MatchingResultClient />
      </section>
      <PublicFooter />
    </main>
  );
}
