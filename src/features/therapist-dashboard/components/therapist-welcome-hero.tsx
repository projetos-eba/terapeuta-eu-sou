import Image from "next/image";

import type { TherapistDashboardPageData } from "../therapist-dashboard.types";
import { TherapistHeroStats } from "./therapist-hero-stats";

export function TherapistWelcomeHero({
  data,
}: {
  data: TherapistDashboardPageData;
}) {
  return (
    <section className="relative isolate min-h-[330px] overflow-hidden rounded-panel bg-[#fbf7ff] px-5 pb-5 pt-8 sm:px-7 lg:min-h-[302px]">
      <Image
        alt=""
        className="absolute inset-y-0 right-0 -z-10 hidden h-full w-[58%] object-cover object-center lg:block"
        height={468}
        priority
        src="/therapist/dashboard/therapist-hero.png"
        width={624}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#fbf7ff] via-[#fbf7ff] to-transparent lg:w-[70%]" />
      <h1 className="font-display text-[42px] font-light italic leading-none text-brand-deep sm:text-[52px]">
        Olá, {firstName(data.therapist.name)}!
      </h1>
      <p className="mt-3 max-w-md text-base font-medium leading-6 text-brand-primary sm:text-lg">
        Tudo o que faz parte da sua jornada reunido em um só lugar.
      </p>
      <div className="mt-8 lg:absolute lg:bottom-5 lg:left-5 lg:w-[min(736px,calc(100%-40px))]">
        <TherapistHeroStats today={data.today} />
      </div>
    </section>
  );
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "Terapeuta";
}
