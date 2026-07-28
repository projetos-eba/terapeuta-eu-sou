import { Check } from "lucide-react";

import { TESCard } from "@/components/tes";

const tips = [
  "Mantenha descrições claras e acolhedoras.",
  "Explique a proposta e o que a pessoa pode esperar da experiência.",
  "Use uma linguagem responsável e sem promessas de resultado.",
  "Revise preço, duração e formato antes de ativar.",
];

export function TherapistServicesTips() {
  return (
    <TESCard as="section" className="p-5 sm:p-6">
      <h2 className="font-display text-3xl font-light italic text-brand-deep">
        Dicas TES
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        Pequenas ações que ajudam mais pessoas a escolherem você.
      </p>
      <ul className="mt-6 grid gap-4">
        {tips.map((tip) => (
          <li
            className="flex gap-3 text-sm font-bold leading-6 text-brand-primary"
            key={tip}
          >
            <Check
              aria-hidden="true"
              className="mt-1 shrink-0 text-status-success"
              size={16}
            />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </TESCard>
  );
}
