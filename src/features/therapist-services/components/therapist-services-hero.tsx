import { Plus } from "lucide-react";

import { TESButton, TESDecorativeMedia } from "@/components/tes";
import { platformAssets } from "@/lib/platform-assets";

export function TherapistServicesHero({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-card bg-white">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.86fr)]">
        <div className="px-6 py-8 sm:px-8 lg:py-12">
          <h1 className="font-display text-4xl font-light italic leading-tight text-brand-deep sm:text-5xl">
            Suas terapias
          </h1>
          <p className="mt-4 max-w-xl text-base font-semibold leading-7 text-tesText-secondary">
            Organize seus atendimentos, mostre como você trabalha e seja
            encontrado por quem precisa de você.
          </p>
          <TESButton
            className="mt-7 min-h-11 w-full rounded-lg sm:w-auto"
            disabled={!canCreate}
            onClick={onCreate}
            type="button"
          >
            <Plus aria-hidden="true" size={18} />
            Adicionar terapia
          </TESButton>
        </div>
        <div className="relative min-h-[210px] overflow-hidden bg-brand-lavenderSoft lg:min-h-[310px]">
          <TESDecorativeMedia
            className="absolute inset-0"
            fade="left"
            objectPosition="right center"
            priority
            sizes="(min-width: 1024px) 520px, 100vw"
            src={platformAssets.therapistServicesHero.src}
          />
        </div>
      </div>
    </section>
  );
}
