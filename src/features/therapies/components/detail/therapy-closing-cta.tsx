import { ArrowRight } from "lucide-react";

import { TESButton } from "@/components/tes";
import { routes } from "@/lib/routes";
import type { PublicTherapyDetail } from "../../types/therapy-detail";
import { DetailIcon } from "./detail-icons";
import { therapyVisualThemes } from "./therapy-visual-theme";

export function TherapyClosingCta({
  therapy,
}: {
  therapy: PublicTherapyDetail;
}) {
  const visualTheme = therapyVisualThemes[therapy.visualThemeKey];

  return (
    <article className="flex h-full flex-col justify-between rounded-[28px] bg-brand-deep p-7 text-white shadow-[0_18px_54px_rgba(38,20,51,0.14)] sm:p-8">
      <div>
        <span
          className={`flex size-16 shrink-0 items-center justify-center rounded-full ${visualTheme.badge}`}
        >
          <DetailIcon iconKey="lotus" />
        </span>
        <h2 className="mt-6 text-3xl font-extrabold leading-tight">
          Cada pessoa é única, e cada caminho também.
        </h2>
        <p className="mt-4 text-base font-semibold leading-7 text-white/78">
          Conheça {therapy.name} com calma e siga para a jornada guiada se
          quiser comparar outros caminhos terapêuticos.
        </p>
      </div>

      <TESButton
        href={routes.public.journey}
        variant="secondary"
        className="mt-7 min-h-12 w-full rounded-[12px] border-white/40 bg-white text-brand-deep hover:bg-white/90"
      >
        Quero encontrar meu caminho
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </TESButton>
    </article>
  );
}
