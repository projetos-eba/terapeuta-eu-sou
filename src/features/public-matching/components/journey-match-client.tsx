"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";

import { TESButton, TESDecorativeMedia } from "@/components/tes";
import { platformAssets } from "@/lib/platform-assets";
import { routes } from "@/lib/routes";

import type { MatchingConfig, MatchingTheme } from "../types";

export const MATCHING_SESSION_KEY = "tes.publicMatching.selection.v1";

const JOURNEY_VISUALS: Record<string, { image: string; title: string }> = {
  "autoconhecimento-transformacao": {
    image: "/journey/autoconhecimento-transformacao.png",
    title: "Autoconhecimento e Transformação",
  },
  "autoestima-poder-pessoal": {
    image: "/journey/autoestima-poder-pessoal.png",
    title: "Autoestima e Poder Pessoal",
  },
  "corpo-relaxamento-qualidade-vida": {
    image: "/journey/corpo-relaxamento.png",
    title: "Corpo, Relaxamento e Qualidade de Vida",
  },
  "corpo-relaxamento": {
    image: "/journey/corpo-relaxamento.png",
    title: "Corpo, Relaxamento e Qualidade de Vida",
  },
  "emocoes-bem-estar": {
    image: "/journey/emocoes-bem-estar.png",
    title: "Emoções e Bem-Estar",
  },
  "energia-equilibrio-energetico": {
    image: "/journey/energia-equilibrio.png",
    title: "Energia e Equilíbrio Energético",
  },
  "energia-equilibrio": {
    image: "/journey/energia-equilibrio.png",
    title: "Energia e Equilíbrio Energético",
  },
  espiritualidade: {
    image: "/journey/espiritualidade-conexao-interior.png",
    title: "Espiritualidade e Conexão Interior",
  },
  "espiritualidade-conexao-interior": {
    image: "/journey/espiritualidade-conexao-interior.png",
    title: "Espiritualidade e Conexão Interior",
  },
  "libertacao-renovacao": {
    image: "/journey/libertacao-renovacao.png",
    title: "Libertação e Renovação",
  },
  "proposito-direcao": {
    image: "/journey/proposito-direcao.png",
    title: "Propósito e Direção",
  },
  relacionamentos: {
    image: "/journey/relacionamentos.png",
    title: "Relacionamentos",
  },
  "vida-profissional-prosperidade": {
    image: "/journey/vida-profissional-prosperidade.png",
    title: "Vida Profissional e Prosperidade",
  },
};

export function JourneyMatchClient({
  config,
  isDemo = false,
}: {
  config: MatchingConfig;
  isDemo?: boolean;
}) {
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const themes = useMemo(() => decorateThemes(config.themes), [config.themes]);
  const selectedThemeSet = useMemo(
    () => new Set(selectedThemeIds),
    [selectedThemeIds],
  );

  useEffect(() => {
    function resetSubmission() {
      setIsSubmitting(false);
    }

    window.addEventListener("pageshow", resetSubmission);

    return () => {
      window.removeEventListener("pageshow", resetSubmission);
    };
  }, []);

  function toggleTheme(themeId: string) {
    setSelectedThemeIds((current) => {
      if (current.includes(themeId)) {
        return current.filter((currentThemeId) => currentThemeId !== themeId);
      }

      if (current.length >= 3) {
        return current;
      }

      return [...current, themeId];
    });
  }

  function submit() {
    if (!selectedThemeIds.length) {
      return;
    }

    setIsSubmitting(true);
    sessionStorage.setItem(
      MATCHING_SESSION_KEY,
      JSON.stringify({
        interestIds: [],
        matchingVersionId: config.versionId,
        source: "journey",
        themeIds: selectedThemeIds,
      }),
    );
    window.location.assign(routes.public.journeyResult);
  }

  return (
    <div className="relative">
      <JourneyStepper />

      {isDemo ? (
        <div className="mt-6 rounded-2xl border border-status-warning/30 bg-status-warningBg px-4 py-3 text-sm font-bold leading-6 text-status-warning">
          Modo demonstração ativo: esta jornada usa dados demonstrativos.
        </div>
      ) : null}

      <section className="mt-12 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:mt-[46px] lg:grid-cols-5 lg:gap-x-3 lg:gap-y-4 xl:gap-x-[12px]">
        {themes.map((theme) => {
          const isSelected = selectedThemeSet.has(theme.id);
          const isDisabled = !isSelected && selectedThemeIds.length >= 3;

          return (
            <button
              key={theme.id}
              type="button"
              disabled={isDisabled}
              onClick={() => toggleTheme(theme.id)}
              className={`group relative min-h-[330px] rounded-[24px] border bg-white p-3 text-left shadow-[0_18px_42px_rgba(74,36,111,0.08)] transition focus:outline-none focus:ring-4 focus:ring-ring/20 lg:min-h-[364px] ${
                isSelected
                  ? "border-brand-primary"
                  : "border-[#eadff6] hover:-translate-y-1 hover:border-brand-lavender"
              } ${isDisabled ? "cursor-not-allowed opacity-45" : ""}`}
            >
              <div className="relative h-[176px] overflow-hidden rounded-[18px] bg-[#f4edfb]">
                <Image
                  src={theme.visual.image}
                  alt=""
                  fill
                  loading="eager"
                  sizes="(min-width: 1024px) 224px, (min-width: 640px) 45vw, 90vw"
                  className="object-cover"
                />
              </div>
              <span
                className={`absolute right-[18px] top-[18px] grid size-[34px] place-items-center rounded-full border-2 transition ${
                  isSelected
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-[#d9c8ec] bg-white/90 text-transparent group-hover:text-brand-primary"
                }`}
              >
                <Check className="size-5" />
              </span>
              <span className="mt-5 block min-h-[58px] px-2 text-[1.14rem] font-extrabold leading-[1.2] text-brand-deep">
                {theme.visual.title}
              </span>
              <span className="mt-3 block px-2 text-[0.86rem] font-semibold leading-[1.62] text-tesText-secondary">
                {theme.description}
              </span>
            </button>
          );
        })}
      </section>

      <p className="mx-auto mt-9 max-w-[650px] text-center text-[1.12rem] font-extrabold text-brand-deep">
        Cada tema já reúne interesses relacionados. Você não precisa escolher
        interesses separadamente.
      </p>

      <section className="mt-6 space-y-6 lg:mt-7 lg:space-y-8">
        {!selectedThemeIds.length ? (
          <div className="rounded-[26px] border border-[#eadff6] bg-white/80 px-6 py-8 text-center shadow-card">
            <p className="text-base font-extrabold text-brand-deep">
              Selecione ao menos uma área acima.
            </p>
            <p className="mt-2 text-sm font-semibold text-tesText-muted">
              O botão “Ver caminhos” fica ativo assim que uma área for
              escolhida.
            </p>
          </div>
        ) : null}
      </section>

      <section className="sticky bottom-0 z-30 -mx-5 mt-8 border-t border-[#eadff6] bg-white/95 px-5 py-4 shadow-[0_-18px_38px_rgba(74,36,111,0.10)] backdrop-blur sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:mt-[22px] lg:rounded-[32px] lg:border lg:bg-white lg:px-[124px] lg:py-[29px] lg:shadow-[0_24px_70px_rgba(74,36,111,0.12)]">
        <div className="grid items-center gap-5 lg:grid-cols-[1fr_413px]">
          <div className="flex items-center gap-5">
            <div className="relative hidden h-[96px] w-[128px] shrink-0 overflow-hidden rounded-[18px] bg-[#f5eefc] lg:block">
              <TESDecorativeMedia
                className="absolute inset-0"
                fade="none"
                imageClassName="scale-110 object-cover"
                sizes="128px"
                src={platformAssets.publicJourneyPathsCard.src}
              />
            </div>
            <div>
              <p className="text-2xl font-extrabold leading-tight text-brand-deep lg:text-[1.72rem]">
                {selectedThemeIds.length
                  ? `${selectedThemeIds.length} ${selectedThemeIds.length === 1 ? "área selecionada" : "áreas selecionadas"}`
                  : "Escolha suas áreas para começar"}
              </p>
              <p className="mt-1 text-sm font-bold leading-6 text-tesText-secondary lg:text-base">
                Os interesses de cada tema já fazem parte da sugestão.
              </p>
            </div>
          </div>
          <TESButton
            type="button"
            disabled={!selectedThemeIds.length || isSubmitting}
            onClick={submit}
            variant="gradient"
            className="min-h-[58px] w-full rounded-[22px] px-8 text-base lg:min-h-[86px] lg:text-[1.2rem]"
          >
            {isSubmitting ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <>
                Ver caminhos para mim
                <ArrowRight className="size-6" />
              </>
            )}
          </TESButton>
        </div>
      </section>
    </div>
  );
}

function JourneyStepper() {
  const steps = ["Sua jornada", "Seus caminhos"];

  return (
    <div className="mt-1 flex max-w-[632px] items-center gap-3 overflow-x-auto pb-1 text-brand-primary lg:mt-0">
      {steps.map((step, index) => (
        <div key={step} className="flex shrink-0 items-center gap-3">
          <span
            className={`grid size-[43px] place-items-center rounded-full border-2 text-base font-extrabold ${
              index === 0
                ? "border-brand-primary bg-brand-primary text-white"
                : "border-[#d8c6ec] bg-white text-brand-primary"
            }`}
          >
            {index + 1}
          </span>
          <span className="text-[1rem] font-extrabold text-brand-primary">
            {step}
          </span>
          {index < steps.length - 1 ? (
            <span className="h-px w-[46px] bg-[#d8c6ec]" />
          ) : null}
        </div>
      ))}
    </div>
  );
}

type DecoratedTheme = MatchingTheme & {
  visual: {
    image: string;
    title: string;
  };
};

function decorateThemes(themes: MatchingTheme[]): DecoratedTheme[] {
  return themes
    .slice()
    .sort((first, second) => first.sortOrder - second.sortOrder)
    .map((theme) => {
      const visual = JOURNEY_VISUALS[theme.slug];

      return {
        ...theme,
        visual: {
          image:
            visual?.image ??
            (theme.imageUrl && !theme.imageUrl.startsWith("/journey/")
              ? theme.imageUrl
              : "/journey/emocoes-bem-estar.png"),
          title: visual?.title ?? theme.name,
        },
      };
    });
}
