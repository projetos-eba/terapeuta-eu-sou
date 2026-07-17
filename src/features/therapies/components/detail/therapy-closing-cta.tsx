import { ArrowRight } from "lucide-react";

import { TESButton } from "@/components/tes";
import { routes } from "@/lib/routes";
import type { PublicTherapyDetail } from "../../types/therapy-detail";
import { DetailIcon } from "./detail-icons";

export function TherapyClosingCta({
  therapy,
}: {
  therapy: PublicTherapyDetail;
}) {
  return (
    <section className="mx-auto max-w-[1288px] px-5 pb-16 sm:px-8 lg:px-12">
      <div className="flex flex-col gap-6 rounded-[26px] bg-white p-7 shadow-[0_18px_54px_rgba(38,20,51,0.08)] sm:flex-row sm:items-center sm:p-9">
        <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white">
          <DetailIcon iconKey="lotus" />
        </span>
        <div className="max-w-2xl">
          <h2 className="text-2xl font-extrabold text-[#3d14ad]">
            Cada pessoa é única, e cada caminho também.
          </h2>
          <p className="mt-3 text-base font-semibold leading-7 text-[#3b3d80]">
            Conheça {therapy.name} com calma e siga para a jornada guiada se
            quiser comparar outros caminhos terapêuticos.
          </p>
          <TESButton
            href={routes.public.journey}
            variant="primary"
            className="mt-5 min-h-12 rounded-[7px]"
          >
            Quero encontrar meu caminho
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </TESButton>
        </div>
      </div>
    </section>
  );
}
