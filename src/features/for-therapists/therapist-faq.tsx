import { ChevronDown, Plus } from "lucide-react";

import { therapistFaqItems } from "./content";

export function TherapistFaq() {
  return (
    <section className="px-5 pb-20 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1320px]">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-brand-deep md:text-4xl">
            Dúvidas de quem atende pelo TES
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
            Respostas para as perguntas mais comuns.
          </p>
        </div>

        <div className="mx-auto mt-7 max-w-[1120px] divide-y divide-brand-lavender/70 overflow-hidden rounded-[18px] border border-brand-lavender/70 bg-white shadow-card">
          {therapistFaqItems.map((item) => (
            <details key={item.question} className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-left outline-none transition hover:bg-brand-lavenderSoft/35 focus-visible:bg-brand-lavenderSoft/45 focus-visible:ring-4 focus-visible:ring-ring/20 sm:min-h-14 sm:px-6 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-3 text-sm font-extrabold leading-6 text-brand-deep sm:text-base">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
                    <Plus
                      aria-hidden="true"
                      className="size-4 transition-transform duration-200 group-open:rotate-45"
                    />
                  </span>
                  {item.question}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 shrink-0 text-brand-primary transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              <div className="border-t border-brand-lavender/60 px-12 py-4 text-sm font-semibold leading-6 text-tesText-secondary sm:px-16 sm:text-base sm:leading-7">
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
