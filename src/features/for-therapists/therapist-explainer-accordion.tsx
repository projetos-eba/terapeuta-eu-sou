import Image from "next/image";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  therapistExplainerAccentIcons,
  type TherapistExplainerAccordion,
} from "./content";

export function TherapistExplainerAccordion({
  accordion,
}: {
  accordion: TherapistExplainerAccordion;
}) {
  const AccentIcon = therapistExplainerAccentIcons[accordion.id];

  return (
    <section className="px-5 pb-16 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1320px]">
        <details className="group overflow-hidden rounded-[26px] border border-brand-lavender/70 bg-white shadow-card">
          <summary className="grid min-h-20 cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-5 text-left outline-none transition hover:bg-brand-lavenderSoft/35 focus-visible:bg-brand-lavenderSoft/45 focus-visible:ring-4 focus-visible:ring-ring/20 sm:min-h-24 sm:gap-6 sm:px-8 lg:px-10 [&::-webkit-details-marker]:hidden">
            <span className="grid size-11 place-items-center rounded-full bg-[linear-gradient(135deg,#6C3D91_0%,#AE94C3_100%)] text-xl font-extrabold text-white sm:size-16 sm:text-2xl">
              {accordion.number}
            </span>
            <span className="min-w-0">
              <span className="block font-display text-[27px] font-light italic leading-[1.08] text-brand-deep sm:text-[36px] lg:text-[42px]">
                {accordion.title}
              </span>
              <span className="mt-2 block text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
                {accordion.subtitle}
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className="size-6 shrink-0 text-brand-primary transition-transform duration-200 group-open:rotate-180 sm:size-8"
            />
          </summary>

          <div className="border-t border-brand-lavender/70 p-4 sm:p-6 lg:grid lg:grid-cols-[minmax(280px,0.62fr)_minmax(0,1.9fr)] lg:gap-6">
            <aside className="relative hidden min-h-[620px] overflow-hidden rounded-[18px] bg-[linear-gradient(155deg,#F4ECFC_0%,#FFF9F4_58%,#F5EEFD_100%)] p-9 lg:flex lg:flex-col">
              <div className="relative z-10 max-w-[210px]">
                <p className="font-display text-[34px] font-light italic leading-[1.12] text-[#6C3D91]">
                  {accordion.eyebrow}
                </p>
                <span className="mt-8 block h-px w-10 bg-brand-primary" />
                <p className="mt-7 text-[11px] font-extrabold uppercase tracking-[0.28em] text-brand-primary">
                  {accordion.id === "alcance"
                    ? "É isso que nos move."
                    : "Juntos por um amanhã mais humano."}
                </p>
              </div>
              <Image
                alt=""
                fill
                sizes="(min-width: 1024px) 350px, 0px"
                src={accordion.decorativeImage}
                className={cn("pointer-events-none opacity-90", accordion.imageClassName)}
              />
              <span className="relative z-10 mt-auto text-[10px] font-extrabold uppercase tracking-[0.24em] text-brand-primary/75">
                Terapeuta Eu Sou
              </span>
            </aside>

            <div className="min-w-0 px-1 py-3 sm:px-2 lg:px-3 lg:py-4">
              <h3 className="text-lg font-extrabold leading-7 text-brand-deep sm:text-xl">
                {accordion.intro.title}
              </h3>
              <p className="mt-1.5 max-w-4xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
                {accordion.intro.body}
              </p>

              <ul className="mt-7 space-y-5 sm:mt-8 sm:space-y-6">
                {accordion.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <li key={item.title} className="flex items-start gap-4 sm:gap-5">
                      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary sm:size-[58px]">
                        <Icon aria-hidden="true" className="size-6 sm:size-7" />
                      </span>
                      <span className="min-w-0 pt-0.5">
                        <span className="block text-base font-extrabold leading-6 text-brand-deep sm:text-lg">
                          {item.title}
                        </span>
                        <span className="mt-1 block max-w-4xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
                          {item.body}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-8 grid gap-4 rounded-[16px] border border-brand-lavender/70 bg-brand-lavenderSoft/65 p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:p-6">
                <AccentIcon aria-hidden="true" className="size-8 text-brand-primary" />
                <div>
                  <p className="text-base font-extrabold leading-6 text-brand-deep">
                    {accordion.accent.title}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                    {accordion.accent.body}
                  </p>
                </div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-primary/80 sm:max-w-[100px] sm:text-right">
                  {accordion.accent.label}
                </p>
              </div>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
