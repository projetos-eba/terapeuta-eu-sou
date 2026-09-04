import { Lightbulb } from "lucide-react";

import { AppPageContainer, AppPageSection } from "@/components/app-page";

export function TherapistAuraComingSoon() {
  return (
    <AppPageContainer className="max-w-[880px] gap-6">
      <AppPageSection className="grid min-h-[360px] place-items-center px-6 py-12 text-center sm:px-10">
        <div className="max-w-xl">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
            <Lightbulb aria-hidden="true" className="size-6" />
          </span>
          <span className="mt-5 inline-flex min-h-7 items-center rounded-full bg-brand-lavenderSoft px-3 text-xs font-extrabold text-brand-primary">
            Em breve
          </span>
          <h1 className="mt-4 font-display text-4xl font-light italic text-brand-deep sm:text-5xl">
            Assessora Aura
          </h1>
          <p className="mt-3 text-sm leading-6 text-tesText-secondary sm:text-base">
            Esta novidade está sendo preparada para acompanhar sua jornada no
            TES com ainda mais clareza.
          </p>
        </div>
      </AppPageSection>
    </AppPageContainer>
  );
}
