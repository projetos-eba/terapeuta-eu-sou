import { PublicServiceDescription } from "@/features/therapist-profile/components/public-service-description";

import type { PublicTherapyDetail } from "../../types/therapy-detail";
import { DetailIcon } from "./detail-icons";
import { therapyVisualThemes } from "./therapy-visual-theme";

export function TherapyOverview({ therapy }: { therapy: PublicTherapyDetail }) {
  const visualTheme = therapyVisualThemes[therapy.visualThemeKey];
  const description = [
    therapy.introduction || therapy.description,
    therapy.complementaryDescription,
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <article
      className={`rounded-[28px] border p-6 shadow-[0_16px_42px_rgba(38,20,51,0.07)] sm:p-7 ${visualTheme.card}`}
    >
      <div className="flex items-center gap-3">
        <span className={visualTheme.accent}>
          <DetailIcon iconKey={therapy.approachIconKey} />
        </span>
        <h2 className="text-[28px] font-extrabold leading-tight text-brand-deep">
          O que é {therapy.name}?
        </h2>
      </div>

      <PublicServiceDescription
        containerClassName="mt-7"
        description={description}
        serviceName={therapy.name}
        textClassName="min-h-0 whitespace-pre-line text-base font-semibold leading-8 text-tesText-secondary"
      />
    </article>
  );
}
