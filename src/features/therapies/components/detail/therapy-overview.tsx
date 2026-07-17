import { Info } from "lucide-react";

import type { PublicTherapyDetail } from "../../types/therapy-detail";
import { DetailIcon } from "./detail-icons";

export function TherapyOverview({ therapy }: { therapy: PublicTherapyDetail }) {
  return (
    <section className="mx-auto grid max-w-[1288px] gap-5 px-5 py-5 sm:px-8 lg:grid-cols-[0.55fr_1fr] lg:px-12">
      <article className="rounded-[14px] border border-[#e5e0f5] bg-white p-7 shadow-[0_10px_24px_rgba(89,56,173,0.10)]">
        <div className="flex items-center gap-3">
          <span className="text-[#8033e0]">
            <DetailIcon iconKey="energy" />
          </span>
          <h2 className="text-[28px] font-extrabold leading-tight text-[#3d14ad]">
            O que é {therapy.name}?
          </h2>
        </div>

        <div className="mt-7 space-y-5 text-base font-semibold leading-8 text-[#3b3d80]">
          <p>{therapy.introduction || therapy.description}</p>
          {therapy.complementaryDescription ? (
            <p>{therapy.complementaryDescription}</p>
          ) : null}
        </div>
      </article>

      <article className="rounded-[14px] border border-[#e5e0f5] bg-white p-7 shadow-[0_10px_24px_rgba(89,56,173,0.10)]">
        <h2 className="text-[22px] font-extrabold text-[#0894ab]">
          Cuidados importantes
        </h2>
        <div className="mt-6 flex gap-4 rounded-2xl bg-[#fbf8ff] p-5 text-[#3b3d80]">
          <Info className="mt-1 h-5 w-5 shrink-0 text-[#8033e0]" aria-hidden="true" />
          <p className="text-base font-semibold leading-7">
            {therapy.safetyNote ??
              "Este conteúdo é informativo e não substitui acompanhamento médico, psicológico ou diagnóstico profissional."}
          </p>
        </div>
        <p className="mt-5 text-base font-semibold leading-8 text-[#3b3d80]">
          A página ajuda você a entender esta abordagem e seguir para
          profissionais relacionados. Preços, duração e horários pertencem aos
          serviços de cada terapeuta.
        </p>
      </article>
    </section>
  );
}
