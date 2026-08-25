"use client";

import { useState, useTransition } from "react";
import {
  CircleHelp,
  CloudRain,
  KeyRound,
  Leaf,
  Sparkles,
  SunMedium,
  Wind,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type {
  MoodKey,
  MoodOption,
  PatientMoodCheckin,
} from "./patient-overview.types";

const moodIcons = {
  calm: SunMedium,
  anxious: Wind,
  confused: CircleHelp,
  hopeful: Leaf,
  inspired: Sparkles,
  sad: CloudRain,
};

const moodVisuals = {
  calm: {
    icon: "bg-status-warningBg text-status-warning",
    selected: "border-status-warning bg-status-warningBg text-status-warning",
  },
  anxious: {
    icon: "bg-status-infoBg text-status-info",
    selected: "border-status-info bg-status-infoBg text-status-info",
  },
  sad: {
    icon: "bg-status-infoBg text-status-info",
    selected: "border-status-info bg-status-infoBg text-status-info",
  },
  confused: {
    icon: "bg-brand-lavenderSoft text-brand-primary",
    selected: "border-brand-primary bg-brand-lavenderSoft text-brand-primary",
  },
  inspired: {
    icon: "bg-status-dangerBg text-status-danger",
    selected: "border-status-danger bg-status-dangerBg text-status-danger",
  },
  hopeful: {
    icon: "bg-status-successBg text-status-success",
    selected: "border-status-success bg-status-successBg text-status-success",
  },
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
          const visual = moodVisuals[option.key];
          const isSelected = selectedMood === option.key;
          return (
            <button
              aria-pressed={isSelected}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-xl border px-3 text-left text-xs font-medium outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20",
                isSelected
                  ? visual.selected
                  : "border-[var(--tes-color-border)] text-brand-primary hover:bg-surface-soft",
              )}
              disabled={isPending}
              key={option.key}
              onClick={() => selectMood(option.key)}
              type="button"
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full",
                  visual.icon,
                )}
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={2} />
              </span>
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mt-7 flex gap-3 text-xs leading-4 text-[var(--tes-color-text-secondary-app)]">
        <KeyRound
          aria-hidden="true"
          className="size-5 shrink-0 text-brand-primary"
        />
        Suas respostas são privadas e ajudam apenas você.
      </p>
    </section>
  );
}
