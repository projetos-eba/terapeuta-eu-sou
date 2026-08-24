import { TESDecorativeMedia } from "@/components/tes";
import { platformAssets } from "@/lib/platform-assets";

import type { TherapistDashboardPageData } from "../therapist-dashboard.types";
import { TherapistHeroStats } from "./therapist-hero-stats";

export function TherapistWelcomeHero({
  data,
}: {
  data: TherapistDashboardPageData;
}) {
  return (
    <section className="relative isolate min-h-[330px] overflow-hidden rounded-panel bg-surface-soft px-5 pb-5 pt-8 sm:px-7 lg:min-h-[302px]">
      <TESDecorativeMedia
        className="absolute inset-y-0 right-0 z-0 hidden w-[58%] lg:block"
        fade="left"
        fadeTone="soft"
        objectPosition="right center"
        priority
        sizes="(min-width: 1024px) 58vw, 0px"
        src={platformAssets.therapistDashboardHero.src}
      />
      <h1 className="relative z-10 font-display text-[42px] font-light italic leading-none text-brand-deep sm:text-[52px]">
        Olá, {firstName(data.therapist.name)}!
      </h1>
      <p className="relative z-10 mt-3 max-w-md text-base font-medium leading-6 text-brand-primary sm:text-lg">
        Tudo o que faz parte da sua jornada reunido em um só lugar.
      </p>
      <div className="relative z-10 mt-8 lg:absolute lg:bottom-5 lg:left-5 lg:w-[min(736px,calc(100%-40px))]">
        <TherapistHeroStats plan={data.therapist.plan} today={data.today} />
      </div>
    </section>
  );
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "Terapeuta";
}
