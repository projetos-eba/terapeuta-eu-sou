import Link from "next/link";
import { ArrowRight, SearchX } from "lucide-react";

import { TESButton, TESCard } from "@/components/tes";
import { routes } from "@/lib/routes";

import { buildHref } from "./category-filter";
import { TherapyCard } from "./therapy-card";
import type { PublicTherapiesResult, TherapySearchParams } from "../types";

type TherapyGridProps = {
  params: TherapySearchParams;
  result: PublicTherapiesResult;
};

export function TherapyGrid({ params, result }: TherapyGridProps) {
  if (result.items.length === 0) {
    return (
      <EmptyState
        hasFilters={Boolean(params.q || params.category)}
        source={result.source}
      />
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {result.items.map((therapy) => (
          <TherapyCard key={therapy.id} therapy={therapy} />
        ))}
      </div>

      {result.page < result.totalPages ? (
        <div className="mt-12 flex justify-center">
          <TESButton
            href={buildHref(params, { page: result.page + 1 })}
            variant="secondary"
            className="min-h-14 min-w-[220px] border-brand-lavender text-brand-primary"
          >
            Ver mais terapias
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </TESButton>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({
  hasFilters,
  source,
}: {
  hasFilters: boolean;
  source: PublicTherapiesResult["source"];
}) {
  const isUnavailable = source === "error" || source === "unconfigured";

  return (
    <TESCard className="flex min-h-[420px] flex-col items-center justify-center rounded-[32px] border-brand-lavender/80 p-8 text-center shadow-[0_18px_48px_rgba(38,20,51,0.08)]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <SearchX className="h-8 w-8" aria-hidden="true" />
      </div>
      <h2 className="mt-6 text-3xl font-extrabold text-brand-deep">
        {isUnavailable
          ? "Catálogo temporariamente indisponível"
          : hasFilters
            ? "Nenhuma terapia encontrada"
            : "Nenhuma terapia publicada"}
      </h2>
      <p className="mt-3 max-w-xl text-base font-semibold leading-7 text-text-secondary">
        {isUnavailable
          ? "A fonte pública de terapias ainda não respondeu neste ambiente. Assim que a migration/view estiver aplicada, as terapias aparecem aqui."
          : hasFilters
          ? "Tente limpar os filtros ou fazer a jornada guiada para encontrar caminhos que conversem com o seu momento."
          : "O catálogo público ainda não tem terapias publicadas. Assim que o admin publicar conteúdos, eles aparecem aqui."}
      </p>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        {hasFilters ? (
          <TESButton href={routes.public.therapies} variant="secondary">
            Limpar filtros
          </TESButton>
        ) : null}
        <TESButton href={routes.public.journey}>
          Fazer jornada guiada
        </TESButton>
      </div>
      {hasFilters ? (
        <Link
          href={routes.public.therapists}
          className="mt-5 text-sm font-extrabold text-brand-primary underline-offset-4 hover:underline"
        >
          Ver terapeutas disponíveis
        </Link>
      ) : null}
    </TESCard>
  );
}
