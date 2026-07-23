"use client";

import { useState, useTransition } from "react";
import { Frown, Leaf, LockKeyhole, Meh, Smile, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

import type {
  MoodKey,
  MoodOption,
  PatientMoodCheckin,
} from "./patient-overview.types";

const moodIcons = {
  calm: Smile,
  anxious: Frown,
  confused: Meh,
  hopeful: Leaf,
  inspired: Sparkles,
  sad: Frown,
};

export function PatientMoodCheckin({
  latestMoodCheckin,
  moodOptions,
  onMoodChange,
}: {
  latestMoodCheckin: PatientMoodCheckin | null;
  moodOptions: MoodOption[];
  onMoodChange?: (mood: MoodKey) => Promise<void>;
}) {
  const [selectedMood, setSelectedMood] = useState<MoodKey | null>(
    latestMoodCheckin?.mood ?? null,
  );
  const [isPending, startTransition] = useTransition();

  function selectMood(mood: MoodKey) {
    setSelectedMood(mood);
    if (onMoodChange) startTransition(() => void onMoodChange(mood));
  }

  return (
    <section
      aria-labelledby="patient-mood-title"
      className="rounded-[var(--tes-radius-auth-card)] border border-[var(--tes-color-border)]/40 bg-white p-6 shadow-[var(--tes-shadow-auth-card)]"
    >
      <h2
        id="patient-mood-title"
        className="font-display text-[29px] font-light italic leading-tight text-[var(--tes-color-primary-dark)]"
      >
        Como você está se sentindo hoje?
      </h2>
      <p className="mt-5 text-xs leading-5 text-[var(--tes-color-text-secondary-app)]">
        Escolha como você se sente para cuidarmos melhor de você.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {moodOptions.map((option) => {
          const Icon = moodIcons[option.key];
          const isSelected = selectedMood === option.key;
          return (
            <button
              aria-pressed={isSelected}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-md border px-3 text-left text-xs font-medium outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20",
                isSelected
                  ? "border-brand-primary bg-brand-lavenderSoft text-brand-primary"
                  : "border-[var(--tes-color-border)] text-brand-primary hover:bg-surface-soft",
              )}
              disabled={isPending}
              key={option.key}
              onClick={() => selectMood(option.key)}
              type="button"
            >
              <Icon aria-hidden="true" className="size-7" strokeWidth={1.5} />
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mt-7 flex gap-3 text-xs leading-4 text-[var(--tes-color-text-secondary-app)]">
        <LockKeyhole
          aria-hidden="true"
          className="size-5 shrink-0 text-black"
        />
        Suas respostas são privadas e ajudam apenas você.
      </p>
    </section>
  );
}
