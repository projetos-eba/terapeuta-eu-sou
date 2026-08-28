import { routes } from "@/lib/routes";
import { platformAssets } from "@/lib/platform-assets";
import { TESButton } from "./tes-button";
import { TESDecorativeMedia } from "./tes-decorative-media";

export function PublicTherapistsLowerBanner() {
  return (
    <div className="relative isolate overflow-hidden rounded-[18px] bg-surface-soft px-6 py-8 sm:px-10 lg:min-h-[178px] lg:px-12">
      <TESDecorativeMedia
        className="absolute inset-0"
        fade="left"
        fadeTone="soft"
        imageClassName="object-right"
        objectPosition="right center"
        quality={95}
        sizes="(min-width: 1024px) 90vw, 100vw"
        src={platformAssets.publicTherapistsLowerBanner.src}
      />
      <div className="relative z-10 max-w-xl">
        <h2 className="font-display text-3xl font-light italic leading-tight text-brand-deep sm:text-4xl">
          Encontre um caminho que faça sentido para você
        </h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
          Explore perfis, conheça abordagens e escolha com calma quem pode
          acompanhar o seu momento.
        </p>
        <TESButton className="mt-5" href={routes.public.therapists}>
          Ver terapeutas
        </TESButton>
      </div>
    </div>
  );
}
