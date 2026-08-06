"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, RefreshCw, UsersRound } from "lucide-react";

import { TESButton, TESCard } from "@/components/tes";
import { routes } from "@/lib/routes";

import { MATCHING_SESSION_KEY } from "./journey-match-client";
import type { MatchingCalculationResult } from "../types";

export function MatchingResultClient() {
  const [result, setResult] = useState<MatchingCalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem(MATCHING_SESSION_KEY);

    if (!stored) {
      window.location.replace(routes.public.journey);
      return;
    }

    async function calculate() {
      try {
        const response = await fetch("/api/public/matching/calculate", {
          body: stored,
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        if (!response.ok) {
          if (response.status === 409) {
            setError(
              "A jornada foi atualizada. Refaca suas escolhas para usar a versao publicada mais recente.",
            );
            return;
          }

          if (response.status === 503) {
            setError(
              "O Match esta temporariamente indisponivel. Tente novamente em alguns instantes.",
            );
            return;
          }

          throw new Error("matching_failed");
        }

        setResult((await response.json()) as MatchingCalculationResult);
      } catch {
        setError("Não conseguimos calcular os caminhos agora. Tente novamente.");
      } finally {
        setIsLoading(false);
      }
    }

    void calculate();
  }, []);

  if (isLoading) {
    return (
      <TESCard className="mx-auto max-w-2xl p-10 text-center">
        <Loader2 className="mx-auto size-10 animate-spin text-brand-primary" />
        <p className="mt-4 text-base font-bold text-tesText-secondary">
          Calculando caminhos possíveis...
        </p>
      </TESCard>
    );
  }

  if (error || !result) {
    return (
      <TESCard className="mx-auto max-w-2xl p-10 text-center">
        <p className="text-base font-bold text-tesText-secondary">{error}</p>
        <TESButton href={routes.public.journey} className="mt-6">
          Refazer jornada
        </TESButton>
      </TESCard>
    );
  }

  return (
    <div>
      {result.lowConfidence ? (
        <div className="mb-6 rounded-2xl border border-brand-lavender bg-brand-lavenderSoft p-5 text-sm font-bold leading-6 text-brand-primary">
          Suas escolhas apontaram uma correspondência mais aberta. Trouxemos os
          caminhos mais próximos para você explorar com calma.
        </div>
      ) : null}

      <div className="grid gap-5">
        {result.results.map((item, index) => (
          <TESCard
            key={item.therapyId}
            className={`overflow-hidden p-0 ${index >= 3 ? "hidden md:block" : ""}`}
          >
            <article className="grid gap-0 md:grid-cols-[260px_1fr]">
              <div className="relative min-h-[220px] overflow-hidden bg-brand-lavenderSoft">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={`Imagem editorial de ${item.title}`}
                    fill
                    sizes="(min-width: 768px) 260px, 100vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="grid h-full min-h-[220px] place-items-center p-8 text-brand-primary">
                    <span className="font-display text-6xl font-light italic">
                      {index + 1}
                    </span>
                  </div>
                )}
                <span className="absolute left-4 top-4 grid size-10 place-items-center rounded-full bg-white/90 font-display text-2xl font-light italic text-brand-primary shadow-card">
                  {index + 1}
                </span>
              </div>
              <div className="p-6 md:p-8">
                <span className="rounded-full bg-status-successBg px-3 py-1 text-xs font-extrabold text-status-success">
                  {item.label}
                </span>
                <h2 className="mt-4 font-display text-4xl font-light italic text-brand-deep">
                  {item.title}
                </h2>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary">
                  {item.explanation}
                </p>
                <div className="mt-5 flex items-center gap-2 text-sm font-extrabold text-brand-primary">
                  <UsersRound className="size-4" />
                  {item.therapistCount === 1
                    ? "1 profissional"
                    : `${item.therapistCount} profissionais`}{" "}
                  com serviço ativo
                </div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <TESButton
                    href={`${routes.public.therapyDetail(item.slug)}?source=match`}
                  >
                    Conhecer terapia
                    <ArrowRight className="size-4" />
                  </TESButton>
                  <TESButton href={routes.public.journey} variant="secondary">
                    <RefreshCw className="size-4" />
                    Refazer jornada
                  </TESButton>
                </div>
              </div>
            </article>
          </TESCard>
        ))}
      </div>

      <p className="mt-8 text-center text-xs font-bold leading-5 text-tesText-muted">
        Este Match sugere caminhos terapêuticos com base nas suas escolhas. Não é
        diagnóstico, tratamento médico nem promessa de resultado.
      </p>
    </div>
  );
}
