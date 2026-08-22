import { Sparkles } from "lucide-react";

import { TESButton } from "@/components/tes";

export function TherapistServicesEmptyState({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <section className="rounded-card border border-dashed border-brand-lavender bg-white p-8 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <Sparkles aria-hidden="true" size={24} />
      </span>
      <h2 className="mt-4 font-display text-3xl font-light italic text-brand-deep">
        Comece adicionando uma terapia
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-sm font-semibold leading-6 text-tesText-secondary">
        Escolha uma terapia disponível e informe preço, duração, descrição e
        como você trabalha.
      </p>
      <TESButton
        className="mt-6 min-h-11 w-full rounded-lg sm:w-auto"
        disabled={!canCreate}
        onClick={onCreate}
        type="button"
      >
        Adicionar primeira terapia
      </TESButton>
    </section>
  );
}
