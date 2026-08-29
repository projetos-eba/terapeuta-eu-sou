import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Leaf } from "lucide-react";

import { TESCard } from "@/components/tes";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

import type { PublicTherapyListItem } from "../types";

type TherapyCardProps = {
  className?: string;
  therapy: PublicTherapyListItem;
};

export function TherapyCard({ className, therapy }: TherapyCardProps) {
  const detailHref = routes.public.therapyDetail(therapy.slug);
  const [primaryTheme, ...additionalThemes] = therapy.themes;

  return (
    <TESCard
      className={cn(
        "group flex h-full min-h-[380px] flex-col items-center overflow-hidden rounded-[16px] border-brand-lavender/80 bg-white px-[15px] pb-[18px] pt-[15px] text-center shadow-[0_11px_16px_rgba(107,61,145,0.10)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(107,61,145,0.16)]",
        className,
      )}
    >
      <div className="relative h-[178px] w-full shrink-0 overflow-hidden rounded-[14px] bg-[radial-gradient(circle_at_50%_42%,#ffffff_0%,#f7f2fb_52%,#efe4f8_100%)]">
        {therapy.imageUrl ? (
          <Image
            src={therapy.imageUrl}
            alt=""
            fill
            quality={95}
            sizes="(min-width: 1180px) 240px, (min-width: 768px) 33vw, 100vw"
            className="object-contain transition duration-500"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Leaf className="h-14 w-14 text-brand-primary" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center overflow-hidden pb-1 pt-5">
        {primaryTheme ? (
          <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5">
            <span className="rounded-full bg-brand-lavenderSoft px-2.5 py-1 text-xs font-bold text-brand-primary">
              {primaryTheme.name}
            </span>
            {additionalThemes.length > 0 ? (
              <span
                aria-label={`${additionalThemes.length} ${additionalThemes.length === 1 ? "tema adicional" : "temas adicionais"} de ${therapy.name}`}
                className="rounded-full bg-surface-soft px-2 py-1 text-xs font-bold text-tesText-secondary"
              >
                +{additionalThemes.length}
                <span className="sr-only">
                  <span>: </span>
                  {additionalThemes.map((theme) => theme.name).join(", ")}
                </span>
              </span>
            ) : null}
          </div>
        ) : null}
        <h2 className="text-[1.38rem] font-semibold leading-[1.18] text-brand-deep">
          {therapy.name}
        </h2>
        <p className="mt-3 min-h-[54px] max-w-[196px] overflow-hidden text-[0.82rem] font-medium leading-[18px] text-tesText-secondary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
          {therapy.shortDescription}
        </p>

        <Link
          href={detailHref as Route<string>}
          className="mt-auto inline-flex min-h-[35px] w-full items-center justify-center gap-2 rounded-[10px] border border-brand-primary/70 bg-white px-4 text-[0.78rem] font-medium text-brand-primary transition hover:bg-brand-lavenderSoft focus:outline-none focus:ring-4 focus:ring-ring/20"
        >
          Saiba mais
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </Link>
      </div>
    </TESCard>
  );
}
