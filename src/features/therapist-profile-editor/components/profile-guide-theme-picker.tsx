"use client";

import { Check, Info } from "lucide-react";
import { useMemo, useState } from "react";

import { DetailIcon } from "@/features/therapies/components/detail/detail-icons";
import { cn } from "@/lib/utils";

import { MAX_THERAPIST_PROFILE_GUIDE_ITEMS } from "../../therapist-profile/types";
import type { TherapistProfileGuideItem } from "../therapist-profile-editor.types";
import {
  guideItemsFromThemes,
  isTherapistProfileGuideThemeItem,
  selectedTherapistProfileGuideThemes,
  therapistProfileGuideThemes,
} from "../therapist-profile-guide-themes";

export function ProfileGuideThemePicker({
  items,
  onChange,
}: {
  items: TherapistProfileGuideItem[];
  onChange: (items: TherapistProfileGuideItem[]) => void;
}) {
  const [message, setMessage] = useState("");
  const selectedThemes = useMemo(
    () => selectedTherapistProfileGuideThemes(items),
    [items],
  );
  const selectedSlugs = new Set(selectedThemes.map((theme) => theme.slug));
  const legacyItems = items.filter(
    (item) => !isTherapistProfileGuideThemeItem(item),
  );

  function toggleTheme(theme: (typeof therapistProfileGuideThemes)[number]) {
    if (selectedSlugs.has(theme.slug)) {
      onChange(
        guideItemsFromThemes(
          selectedThemes.filter((selected) => selected.slug !== theme.slug),
        ),
      );
      setMessage("");
      return;
    }

    if (selectedThemes.length >= MAX_THERAPIST_PROFILE_GUIDE_ITEMS) {
      setMessage("Você pode escolher até 6 temas.");
      return;
    }

    onChange(guideItemsFromThemes([...selectedThemes, theme]));
    setMessage("");
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className="text-sm font-semibold leading-6 text-tesText-secondary"
          id="guideItems-description"
        >
          Escolha até 6 temas que representam os caminhos pelos quais você pode
          acompanhar cada pessoa.
        </p>
        <span className="shrink-0 rounded-full bg-brand-lavenderSoft px-3 py-1.5 text-sm font-extrabold text-brand-primary">
          {selectedThemes.length}/{MAX_THERAPIST_PROFILE_GUIDE_ITEMS}{" "}
          selecionados
        </span>
      </div>

      <div
        aria-describedby="guideItems-description"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        role="group"
      >
        {therapistProfileGuideThemes.map((theme) => {
          const selected = selectedSlugs.has(theme.slug);

          return (
            <button
              aria-pressed={selected}
              className={cn(
                "group relative flex min-h-[104px] items-start gap-3 rounded-xl border bg-white p-4 text-left transition hover:border-brand-primary hover:bg-brand-lavenderSoft/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary",
                selected
                  ? "border-brand-primary bg-brand-lavenderSoft shadow-card"
                  : "border-brand-lavender/70 shadow-card",
              )}
              data-guide-theme={theme.slug}
              key={theme.slug}
              onClick={() => toggleTheme(theme)}
              type="button"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-full text-brand-primary transition",
                  selected
                    ? "bg-white"
                    : "bg-brand-lavenderSoft group-hover:bg-white",
                )}
              >
                <DetailIcon iconKey={theme.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block pr-6 text-sm font-extrabold leading-5 text-brand-deep">
                  {theme.label}
                </span>
                <span className="mt-1 block text-sm font-semibold leading-5 text-tesText-secondary">
                  {theme.description}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "absolute right-3 top-3 grid size-6 place-items-center rounded-full border",
                  selected
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-brand-lavender text-transparent",
                )}
              >
                <Check className="size-4" />
              </span>
            </button>
          );
        })}
      </div>

      {message ? (
        <p
          aria-live="polite"
          className="text-sm font-bold text-status-warning"
          role="status"
        >
          {message}
        </p>
      ) : null}

      {legacyItems.length > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warningBg px-3 py-3 text-sm font-semibold leading-5 text-brand-deep">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>
            Você ainda tem caminhos personalizados salvos anteriormente. Eles
            continuam no perfil até que você escolha um dos temas acima; ao
            escolher, serão substituídos por até 6 temas da plataforma.
          </p>
        </div>
      ) : null}
    </div>
  );
}
