import Image from "next/image";
import { ArrowRight, Search } from "lucide-react";

import { TESButton } from "@/components/tes";
import type { PublicTherapyDetail } from "../../types/therapy-detail";
import { DetailIcon } from "./detail-icons";
import { buildTherapistsByTherapyHref } from "./detail-links";

type TherapyHeroProps = {
  relatedCount: number;
  source: string;
  therapy: PublicTherapyDetail;
};

export function TherapyHero({
  relatedCount,
  source,
  therapy,
}: TherapyHeroProps) {
  const heroCtaHref =
    relatedCount > 0
      ? "#profissionais"
      : buildTherapistsByTherapyHref({
          source,
          therapySlug: therapy.slug,
        });

  return (
    <section className="relative isolate overflow-hidden bg-[#fefdff]">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 pb-12 pt-8 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:px-12 lg:pb-10 lg:pt-12">
        <div className="order-1 lg:pr-2">
          <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#e5fafc] px-5 text-sm font-extrabold text-[#0894ab]">
            <DetailIcon iconKey="energy" />
            {therapy.category.name}
          </span>

          <h1 className="mt-5 font-serif text-[72px] font-light italic leading-[0.86] text-[#3d14ad] sm:text-[96px] lg:text-[116px]">
            {therapy.name}
          </h1>

          <p className="mt-5 max-w-[520px] text-xl font-bold leading-8 text-[#3b3d80] sm:text-2xl sm:leading-10">
            {therapy.subtitle}
          </p>

          {therapy.highlights.length > 0 ? (
            <div className="mt-7 grid gap-4 sm:grid-cols-3 lg:grid-cols-3">
              {therapy.highlights.map((highlight) => (
                <div
                  key={`${highlight.iconKey}-${highlight.title}`}
                  className="flex min-h-[58px] items-center gap-3"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#d9f8ff] text-[#0f87bd]">
                    <DetailIcon iconKey={highlight.iconKey} />
                  </span>
                  <span className="text-sm font-extrabold leading-tight text-[#3b3d80]">
                    {highlight.title}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <TESButton
            href={heroCtaHref}
            variant="gradient"
            className="mt-9 min-h-[60px] w-full rounded-[10px] bg-[linear-gradient(90deg,#0591bd_0%,#8c2edb_100%)] text-base sm:w-auto sm:min-w-[320px]"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
            Encontrar um terapeuta
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </TESButton>
        </div>

        <div className="order-2 lg:order-2">
          <div className="relative min-h-[285px] overflow-hidden rounded-[34px] bg-brand-lavenderSoft shadow-[0_24px_74px_rgba(38,20,51,0.12)] sm:min-h-[420px] lg:min-h-[520px] lg:rounded-l-[330px] lg:rounded-r-none">
            {therapy.heroImageUrl ? (
              <Image
                src={therapy.heroImageUrl}
                alt=""
                fill
                priority
                sizes="(min-width: 1024px) 860px, 100vw"
                className="object-cover object-center"
              />
            ) : (
              <div className="flex h-full min-h-[285px] items-center justify-center bg-[radial-gradient(circle_at_50%_35%,#ffffff_0,#eef9fb_46%,#e2d1ec_100%)] sm:min-h-[420px] lg:min-h-[520px]">
                <DetailIcon iconKey="sparkles" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
