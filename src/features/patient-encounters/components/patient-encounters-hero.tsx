import { TESDecorativeMedia } from "@/components/tes";
import { platformAssets } from "@/lib/platform-assets";

export function PatientEncountersHero() {
  return (
    <header
      aria-labelledby="patient-encounters-page-title"
      className="relative isolate overflow-hidden rounded-panel bg-white px-5 py-8 sm:min-h-[270px] sm:px-11 sm:py-11"
    >
      <TESDecorativeMedia
        className="absolute inset-y-0 right-0 w-[68%] sm:w-[64%]"
        fade="left"
        objectPosition="right center"
        priority
        sizes="(max-width: 639px) 68vw, (max-width: 1080px) 64vw, 690px"
        src={platformAssets.patientEncountersHero.src}
      />

      <div className="relative z-10 max-w-[17ch] sm:max-w-[450px]">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-brand-primary sm:text-xs">
          Encontros
        </p>
        <h1
          className="mt-3 font-display text-[2.35rem] font-light italic leading-[0.98] text-brand-deep sm:mt-4 sm:text-[3rem] sm:leading-[1.12] lg:text-[3.25rem]"
          id="patient-encounters-page-title"
        >
          Seu espaço de acompanhamento
        </h1>
        <p className="mt-4 max-w-[26ch] text-sm font-semibold leading-6 text-tesText-secondary sm:mt-5 sm:text-base sm:leading-7">
          Tudo o que faz parte da sua jornada reunido em um único lugar.
        </p>
      </div>
    </header>
  );
}
