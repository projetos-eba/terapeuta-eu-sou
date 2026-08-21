import Image from "next/image";

import type { PublicTherapyDetail } from "../../types/therapy-detail";
import { DetailIcon } from "./detail-icons";
import { therapyVisualThemes } from "./therapy-visual-theme";

type TherapyHeroProps = {
  therapy: PublicTherapyDetail;
};

const focalPointClassName: Record<PublicTherapyDetail["heroFocalPoint"], string> = {
  center: "object-center",
  left: "object-left",
  right: "object-right",
};

export function TherapyHero({ therapy }: TherapyHeroProps) {
  const visualTheme = therapyVisualThemes[therapy.visualThemeKey];
  return (
    <div>
      <span
        className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-extrabold ${visualTheme.badge}`}
      >
        <DetailIcon iconKey={therapy.approachIconKey} />
        {therapy.approachLabel}
      </span>

      <h1 className="mt-5 max-w-[780px] break-words font-display text-[clamp(4rem,9vw,6.75rem)] font-light italic leading-[0.92] text-brand-deep [text-wrap:balance]">
        {therapy.name}
      </h1>

      <p className="mt-5 max-w-[560px] text-xl font-bold leading-8 text-[#6c6698] sm:text-2xl sm:leading-10">
        {therapy.subtitle}
      </p>

      {therapy.highlights.length > 0 ? (
        <div className="mt-7 grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {therapy.highlights.map((highlight) => (
            <div
              key={`${highlight.iconKey}-${highlight.title}`}
              className="flex min-h-[64px] items-center gap-3 rounded-[18px] border border-[#eee7f8] bg-white px-4 shadow-[0_10px_28px_rgba(38,20,51,0.05)]"
            >
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-full ${visualTheme.benefitIcon}`}
              >
                <DetailIcon iconKey={highlight.iconKey} />
              </span>
              <span className="text-sm font-extrabold leading-tight text-[#3b2a63]">
                {highlight.title}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TherapyHeroImage({ therapy }: { therapy: PublicTherapyDetail }) {
  const visualTheme = therapyVisualThemes[therapy.visualThemeKey];

  return (
    <div
      className={`relative min-h-[280px] overflow-hidden rounded-[32px] bg-brand-lavenderSoft shadow-[0_24px_74px_rgba(38,20,51,0.12)] ring-1 ${visualTheme.imageRing} sm:min-h-[420px] lg:min-h-[520px]`}
    >
      {therapy.heroImageUrl ? (
        <Image
          src={therapy.heroImageUrl}
          alt=""
          fill
          priority
          quality={95}
          sizes="(min-width: 1024px) 720px, 100vw"
          className={`object-cover ${focalPointClassName[therapy.heroFocalPoint]}`}
        />
      ) : (
        <div
          className={`flex h-full min-h-[280px] items-center justify-center ${visualTheme.soft} sm:min-h-[420px] lg:min-h-[520px]`}
        >
          <DetailIcon iconKey="sparkles" />
        </div>
      )}
    </div>
  );
}
