"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { TESInput } from "@/components/tes";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

import type { TherapyCatalogOption } from "../therapist-services.types";

export function TherapyCatalogPicker({
  catalog,
  selectedTherapyId,
  onSelect,
}: {
  catalog: TherapyCatalogOption[];
  onSelect: (therapy: TherapyCatalogOption) => void;
  selectedTherapyId: string | null;
}) {
  const [query, setQuery] = useState("");
  const grouped = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    const filtered = catalog.filter((therapy) => {
      if (!normalized) return true;
      return (
        therapy.name.toLocaleLowerCase("pt-BR").includes(normalized) ||
        therapy.category.name.toLocaleLowerCase("pt-BR").includes(normalized)
      );
    });
    const groups = new Map<string, TherapyCatalogOption[]>();

    for (const therapy of filtered) {
      const key = therapy.category.name;
      groups.set(key, [...(groups.get(key) ?? []), therapy]);
    }

    return Array.from(groups.entries());
  }, [catalog, query]);

  return (
    <div>
      <label
        className="text-sm font-extrabold text-brand-deep"
        htmlFor="service-therapy-search"
      >
        Buscar terapia
      </label>
      <TESInput
        id="service-therapy-search"
        leftIcon={
          <Search aria-hidden="true" className="text-brand-primary" size={18} />
        }
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Reiki, Tarô, Aromaterapia..."
        value={query}
        wrapperClassName="mt-2 h-12 rounded-lg shadow-none"
      />

      <div
        aria-label="Terapias disponíveis"
        className="mt-4 max-h-[42vh] space-y-5 overflow-y-auto pr-1"
        role="listbox"
      >
        {grouped.length > 0 ? (
          grouped.map(([category, therapies]) => (
            <section key={category}>
              <h3 className="text-xs font-extrabold uppercase tracking-[0.08em] text-tesText-muted">
                {category}
              </h3>
              <div className="mt-2 grid gap-2">
                {therapies.map((therapy) => {
                  const selected = therapy.therapyId === selectedTherapyId;

                  return (
                    <button
                      aria-selected={selected}
                      className={cn(
                        "min-h-20 rounded-lg border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary",
                        selected
                          ? "border-brand-primary bg-brand-lavenderSoft"
                          : "border-brand-lavender bg-white hover:bg-brand-lavenderSoft/60",
                      )}
                      key={therapy.therapyId}
                      onClick={() => onSelect(therapy)}
                      role="option"
                      type="button"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span>
                          <strong className="block text-sm text-brand-deep">
                            {therapy.name}
                          </strong>
                          <span className="mt-1 block text-xs font-bold text-brand-primary">
                            {therapy.category.name}
                          </span>
                        </span>
                        <span className="rounded-full bg-status-successBg px-3 py-1 text-[11px] font-extrabold text-status-success">
                          Disponível
                        </span>
                      </span>
                      {therapy.shortDescription ? (
                        <span className="mt-2 line-clamp-2 block text-xs font-semibold leading-5 text-tesText-secondary">
                          {therapy.shortDescription}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <div className="rounded-lg border border-brand-lavender bg-brand-lavenderSoft/50 p-4">
            <p className="text-sm font-extrabold text-brand-deep">
              Nenhuma terapia encontrada
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-tesText-secondary">
              Você pode enviar uma sugestão, mas a terapia precisa estar
              disponível no TES para ser adicionada.
            </p>
          </div>
        )}
      </div>

      <Link
        className="mt-4 min-h-11 rounded-lg px-3 text-left text-sm font-extrabold text-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
        href={routes.therapist.therapyCatalogRequest}
      >
        Não encontrou sua terapia?
        <span className="ml-2 text-xs font-bold text-tesText-muted">
          Envie uma sugestão para análise da plataforma.
        </span>
      </Link>
    </div>
  );
}
