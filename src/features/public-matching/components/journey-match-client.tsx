"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";

import { TESButton } from "@/components/tes";
import { routes } from "@/lib/routes";

import type { MatchingConfig, MatchingTheme } from "../types";

export const MATCHING_SESSION_KEY = "tes.publicMatching.selection.v1";

const FIGMA_AREAS = [
  {
    image: "/journey/emocoes-bem-estar.png",
    title: "Emoções e Bem-Estar",
  },
  {
    image: "/journey/relacionamentos.png",
    title: "Relacionamentos",
  },
  {
    image: "/journey/autoconhecimento-transformacao.png",
    title: "Autoconhecimento e Transformação",
  },
  {
    image: "/journey/proposito-direcao.png",
    title: "Propósito e Direção",
  },
  {
    image: "/journey/autoestima-poder-pessoal.png",
    title: "Autoestima e Poder Pessoal",
  },
  {
    image: "/journey/espiritualidade-conexao-interior.png",
    title: "Espiritualidade e Conexão Interior",
  },
  {
    image: "/journey/energia-equilibrio.png",
    title: "Energia e Equilíbrio Energético",
  },
  {
    image: "/journey/libertacao-renovacao.png",
    title: "Libertação e Renovação",
  },
  {
    image: "/journey/corpo-relaxamento.png",
    title: "Corpo, Relaxamento e Qualidade de Vida",
  },
  {
    image: "/journey/vida-profissional-prosperidade.png",
    title: "Vida Profissional e Prosperidade",
  },
];

const DETAIL_COPY: Record<string, { badge: string; subtitle: string }> = {
  "autoestima-poder-pessoal": {
    badge: "Autocuidado",
    subtitle: "Escolha interesses que ajudam a refinar autoestima e confiança.",
  },
  "corpo-energia": {
    badge: "Energia",
    subtitle: "Marque sinais do corpo e da rotina que mais aparecem agora.",
  },
  "criatividade-expressao": {
    badge: "Expressão",
    subtitle: "Selecione interesses ligados a voz própria e novos caminhos.",
  },
  "equilibrio-emocional": {
    badge: "Ansiedade",
    subtitle: "Selecione o que está mais presente para você neste momento.",
  },
  "espiritualidade": {
    badge: "Conexão",
    subtitle: "Escolha interesses que expressem sua busca interior.",
  },
  "estresse-ansiedade": {
    badge: "Rotina",
    subtitle: "Indique pontos que podem ajudar a encontrar uma pausa possível.",
  },
  "luto-despedidas": {
    badge: "Acolhimento",
    subtitle: "Marque interesses ligados a despedidas e encerramentos.",
  },
  "mudancas-de-vida": {
    badge: "Transição",
    subtitle: "Selecione o que melhor descreve essa fase de mudança.",
  },
  "proposito-direcao": {
    badge: "Clareza",
    subtitle: "Escolha interesses que ajudem a orientar os próximos passos.",
  },
  relacionamentos: {
    badge: "Vínculos",
    subtitle: "Selecione os temas relacionais que fazem sentido para você.",
  },
};

export function JourneyMatchClient({ config }: { config: MatchingConfig }) {
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);
  const [selectedInterestIds, setSelectedInterestIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const themes = useMemo(() => decorateThemes(config.themes), [config.themes]);
  const selectedThemeSet = useMemo(
    () => new Set(selectedThemeIds),
    [selectedThemeIds],
  );
  const selectedThemes = themes.filter((theme) => selectedThemeSet.has(theme.id));
  const selectedInterestCount = selectedInterestIds.length;

  function toggleTheme(themeId: string) {
    setSelectedThemeIds((current) => {
      if (current.includes(themeId)) {
        setSelectedInterestIds((interests) =>
          interests.filter((interestId) => {
            const interestThemeId = themes
              .flatMap((theme) => theme.interests)
              .find((interest) => interest.id === interestId)?.themeId;

            return interestThemeId !== themeId;
          }),
        );
        return current.filter((currentThemeId) => currentThemeId !== themeId);
      }

      if (current.length >= 3) {
        return current;
      }

      return [...current, themeId];
    });
  }

  function toggleInterest(interestId: string, themeId: string) {
    if (!selectedThemeSet.has(themeId)) {
      return;
    }

    setSelectedInterestIds((current) => {
      if (current.includes(interestId)) {
        return current.filter((currentInterestId) => currentInterestId !== interestId);
      }

      const themeInterestCount = current.filter((currentInterestId) => {
        const interest = themes
          .flatMap((theme) => theme.interests)
          .find((item) => item.id === currentInterestId);

        return interest?.themeId === themeId;
      }).length;

      if (themeInterestCount >= 3) {
        return current;
      }

      return [...current, interestId];
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
        interestIds: selectedInterestIds,
        source: "journey",
        themeIds: selectedThemeIds,
      }),
    );
    window.location.assign(routes.public.journeyResult);
  }

  return (
    <div className="relative">
      <JourneyStepper />

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

      <p className="mx-auto mt-9 max-w-[560px] text-center text-[1.12rem] font-extrabold text-brand-deep">
        Agora, se quiser, escolha interesses dentro das áreas selecionadas.
      </p>

      <section className="mt-6 space-y-6 lg:mt-7 lg:space-y-8">
        {selectedThemes.length ? (
          selectedThemes.map((theme) => (
            <ThemeDetailPanel
              key={theme.id}
              selectedInterestIds={selectedInterestIds}
              theme={theme}
              onToggleInterest={toggleInterest}
            />
          ))
        ) : (
          <div className="rounded-[26px] border border-[#eadff6] bg-white/80 px-6 py-8 text-center shadow-card">
            <p className="text-base font-extrabold text-brand-deep">
              Selecione ao menos uma área acima.
            </p>
            <p className="mt-2 text-sm font-semibold text-tesText-muted">
              O botão “Ver caminhos” fica ativo assim que uma área for escolhida.
            </p>
          </div>
        )}
      </section>

      <section className="sticky bottom-0 z-30 -mx-5 mt-8 border-t border-[#eadff6] bg-white/95 px-5 py-4 shadow-[0_-18px_38px_rgba(74,36,111,0.10)] backdrop-blur sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:mt-[22px] lg:rounded-[32px] lg:border lg:bg-white lg:px-[124px] lg:py-[29px] lg:shadow-[0_24px_70px_rgba(74,36,111,0.12)]">
        <div className="grid items-center gap-5 lg:grid-cols-[1fr_413px]">
          <div className="flex items-center gap-5">
            <div className="hidden h-[83px] w-[112px] shrink-0 rounded-[18px] bg-[#f5eefc] text-brand-primary lg:grid lg:place-items-center">
              <span className="text-sm font-extrabold uppercase tracking-[0.08em]">
                Ícone
              </span>
            </div>
            <div>
              <p className="text-2xl font-extrabold leading-tight text-brand-deep lg:text-[1.72rem]">
                {selectedThemeIds.length
                  ? `${selectedThemeIds.length} ${selectedThemeIds.length === 1 ? "área selecionada" : "áreas selecionadas"}`
                  : "Escolha suas áreas para começar"}
              </p>
              <p className="mt-1 text-sm font-bold leading-6 text-tesText-secondary lg:text-base">
                {selectedInterestCount
                  ? `${selectedInterestCount} ${selectedInterestCount === 1 ? "interesse escolhido" : "interesses escolhidos"} para refinar seus caminhos.`
                  : "Depois de escolher uma área, você pode refinar com interesses específicos."}
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
  const steps = ["Sua jornada", "Refinar", "Seus caminhos"];

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

function ThemeDetailPanel({
  onToggleInterest,
  selectedInterestIds,
  theme,
}: {
  onToggleInterest: (interestId: string, themeId: string) => void;
  selectedInterestIds: string[];
  theme: DecoratedTheme;
}) {
  const selectedCount = selectedInterestIds.filter((interestId) =>
    theme.interests.some((interest) => interest.id === interestId),
  ).length;
  const detail = DETAIL_COPY[theme.slug] ?? {
    badge: "Interesses",
    subtitle: "Selecione até 3 interesses para refinar este tema.",
  };

  return (
    <article className="grid overflow-hidden rounded-[30px] border border-[#eadff6] bg-white shadow-[0_20px_52px_rgba(74,36,111,0.08)] lg:grid-cols-[230px_1fr]">
      <div className="relative hidden min-h-[314px] bg-[#f4edfb] lg:block">
        <Image
          src={theme.visual.image}
          alt=""
          fill
          sizes="230px"
          className="object-cover"
        />
      </div>
      <div className="p-5 sm:p-7 lg:px-9 lg:py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[1.5rem] font-extrabold leading-tight text-brand-deep lg:text-[1.72rem]">
                {theme.visual.title}
              </h2>
              <span className="rounded-full bg-[#f0e6fb] px-3 py-1 text-xs font-extrabold text-brand-primary">
                {detail.badge}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary lg:text-base">
              {detail.subtitle}
            </p>
          </div>
          <span className="rounded-full bg-brand-lavenderSoft px-3 py-1 text-xs font-extrabold text-brand-primary">
            {selectedCount}/3
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {theme.interests.map((interest) => {
            const isSelected = selectedInterestIds.includes(interest.id);
            const isDisabled = !isSelected && selectedCount >= 3;

            return (
              <button
                key={interest.id}
                type="button"
                disabled={isDisabled}
                onClick={() => onToggleInterest(interest.id, theme.id)}
                className={`flex min-h-[58px] items-center gap-3 rounded-[16px] border px-4 text-left text-sm font-extrabold transition focus:outline-none focus:ring-4 focus:ring-ring/20 ${
                  isSelected
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-[#eadff6] bg-white text-brand-deep hover:border-brand-lavender"
                } ${isDisabled ? "cursor-not-allowed opacity-45" : ""}`}
              >
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-[7px] border ${
                    isSelected
                      ? "border-white bg-white text-brand-primary"
                      : "border-[#d8c6ec] bg-white text-transparent"
                  }`}
                >
                  <Check className="size-4" />
                </span>
                <span>{interest.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </article>
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
    .map((theme, index) => ({
      ...theme,
      visual: {
        image:
          theme.imageUrl && theme.imageUrl.startsWith("/journey/")
            ? theme.imageUrl
            : FIGMA_AREAS[index]?.image ?? "/journey/emocoes-bem-estar.png",
        title: FIGMA_AREAS[index]?.title ?? theme.name,
      },
    }));
}
