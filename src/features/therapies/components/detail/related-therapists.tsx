import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, SearchX } from "lucide-react";

import { TESButton } from "@/components/tes";
import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";
import type {
  PublicTherapyDetail,
  RelatedTherapist,
  RelatedTherapistSort,
} from "../../types/therapy-detail";
import { DetailIcon } from "./detail-icons";
import { buildTherapistsByTherapyHref } from "./detail-links";
import { RelatedTherapistCard } from "./related-therapist-card";
import { therapyVisualThemes } from "./therapy-visual-theme";

type RelatedTherapistsProps = {
  errorMessage?: string;
  source: string;
  sort: RelatedTherapistSort;
  therapists: RelatedTherapist[];
  therapy: PublicTherapyDetail;
};

const sortLabels: Record<RelatedTherapistSort, string> = {
  next_slot: "Próximo horário",
  rating: "Melhor avaliação",
  relevance: "Mais relevantes",
};

export function RelatedTherapists({
  errorMessage,
  source,
  sort,
  therapists,
  therapy,
}: RelatedTherapistsProps) {
  const visualTheme = therapyVisualThemes[therapy.visualThemeKey];
  const therapistsHref = buildTherapistsByTherapyHref({
    source,
    therapySlug: therapy.slug,
  });

  return (
    <section id="profissionais" className="scroll-mt-8">
      <div className="rounded-hero border border-border bg-surface-elevated p-5 shadow-card sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className={visualTheme.accent}>
                <DetailIcon iconKey="energy" />
              </span>
              <h2 className="text-[28px] font-extrabold leading-tight text-brand-deep sm:text-[29px]">
                Profissionais que trabalham com {therapy.name}
              </h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary">
              Terapeutas publicados com serviço online ativo relacionado a esta
              terapia.
            </p>
          </div>

          <form
            action={routes.public.therapyDetail(therapy.slug)}
            className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center"
          >
            <input type="hidden" name="source" value={source} />
            <label
              htmlFor="related-sort"
              className="text-sm font-bold text-tesText-secondary"
            >
              Ordenar por:
            </label>
            <select
              id="related-sort"
              name="sort"
              defaultValue={sort}
              className="min-h-11 w-full rounded-md border border-border bg-white px-4 text-sm font-bold text-tesText-primary outline-none focus:ring-4 focus:ring-ring/20 sm:w-[210px]"
            >
              {Object.entries(sortLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button className="min-h-11 rounded-full bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover">
              Aplicar
            </button>
          </form>
        </div>

        {errorMessage ? (
          <div className="mt-7 rounded-2xl bg-[#fbf8ff] p-5 text-sm font-semibold leading-6 text-[#6b669e]">
            {errorMessage}
          </div>
        ) : null}

        {therapists.length > 0 ? (
          <div
            className={cn(
              "mt-7 grid gap-0 overflow-hidden rounded-md border border-border bg-white",
              therapists.length > 1 ? "lg:grid-cols-2" : "lg:max-w-[680px]",
            )}
          >
            {therapists.map((therapist) => (
              <RelatedTherapistCard
                key={therapist.slug}
                source={source}
                therapist={therapist}
                therapySlug={therapy.slug}
              />
            ))}
          </div>
        ) : (
          <div className="mt-7 flex flex-col items-center rounded-panel border border-border bg-white px-5 py-12 text-center">
            <span className="flex size-20 items-center justify-center rounded-full bg-brand-lavenderSoft text-brand-primary">
              <SearchX className="h-9 w-9" aria-hidden="true" />
            </span>
            <h3 className="mt-6 text-3xl font-extrabold text-brand-deep">
              Ainda não encontramos profissionais disponíveis para esta terapia.
            </h3>
            <p className="mt-3 max-w-2xl text-base font-semibold leading-7 text-text-secondary">
              A terapia pode continuar pública mesmo sem profissionais ativos.
              Você pode ver todos os terapeutas ou refazer a jornada guiada.
            </p>
            <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <TESButton
                href={routes.public.therapists}
                variant="gradient"
                className="min-h-12"
              >
                Ver todos os terapeutas
              </TESButton>
              <TESButton
                href={routes.public.journey}
                variant="secondary"
                className="min-h-12"
              >
                Refazer minha jornada
              </TESButton>
            </div>
          </div>
        )}

        {therapists.length > 0 ? (
          <Link
            href={therapistsHref as Route<string>}
            className="mx-auto mt-5 flex min-h-12 w-fit items-center gap-2 rounded-full px-5 text-base font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus:outline-none focus:ring-4 focus:ring-ring/20"
          >
            Ver todos os terapeutas deste caminho
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
