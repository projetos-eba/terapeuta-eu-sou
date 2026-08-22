import type { Metadata } from "next";
import { connection } from "next/server";
import { CircleDot, Info } from "lucide-react";

import { PublicFooter, PublicHeader } from "@/components/tes";
import {
  getPublicMatchingConfig,
  JourneyMatchClient,
} from "@/features/public-matching";

export const metadata: Metadata = {
  description:
    "Jornada anônima e determinística para sugerir caminhos terapêuticos no Terapeuta Eu Sou.",
  title: "Sua Jornada | Terapeuta Eu Sou",
};

export default async function JourneyPage() {
  await connection();

  const configResult = await getPublicMatchingConfig();

  return (
    <main className="min-h-screen overflow-hidden bg-[#fbf9ff] text-tesText-primary">
      <PublicHeader />

      <section className="relative mx-auto max-w-[1440px] px-5 pb-12 pt-7 sm:px-8 lg:px-[68px] lg:pb-16 lg:pt-[70px]">
        <div
          className="pointer-events-none absolute right-[-122px] top-[-96px] hidden h-[821px] w-[1095px] bg-[url('/journey/hero-section-fade.png')] bg-contain bg-right-top bg-no-repeat lg:block"
          aria-hidden="true"
        />
        <div className="relative min-h-[462px] lg:min-h-[570px]">
          <div className="max-w-[530px] pt-8 lg:pt-[30px]">
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-brand-lavender/60 bg-white/80 px-3 text-xs font-extrabold text-brand-primary shadow-card backdrop-blur">
              <CircleDot className="size-[18px]" aria-hidden="true" />
              Emoções e bem-estar
            </span>
            <h1 className="mt-8 font-display text-[3.45rem] font-light italic leading-[0.98] text-brand-deep sm:text-[4.5rem] lg:text-[5.3rem]">
              Como você está se sentindo?
            </h1>
            <p className="mt-8 max-w-[520px] text-[1.08rem] font-semibold leading-8 text-tesText-secondary lg:text-[1.2rem]">
              Selecione até 3 temas que mais conversam com o seu momento. O TES
              usa os interesses já associados a cada tema para sugerir caminhos.
            </p>
          </div>
        </div>

        {configResult.status === "unavailable" ? (
          <div className="relative rounded-[26px] border border-status-warning/30 bg-white/90 p-8 text-center shadow-card">
            <p className="text-base font-extrabold text-brand-deep">
              O Match está temporariamente indisponível.
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary">
              Não encontramos uma versão publicada da jornada agora. Você ainda
              pode explorar o catálogo de terapias com calma.
            </p>
          </div>
        ) : (
          <JourneyMatchClient
            config={configResult.config}
            isDemo={configResult.status === "demo"}
          />
        )}
      </section>

      <PublicFooter />
    </main>
  );
}
