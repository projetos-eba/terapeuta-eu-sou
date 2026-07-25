import type { PublicTherapyDetail } from "../../types/therapy-detail";
import { DetailIcon } from "./detail-icons";
import { therapyVisualThemes } from "./therapy-visual-theme";

export function TherapyBenefits({ therapy }: { therapy: PublicTherapyDetail }) {
  const visualTheme = therapyVisualThemes[therapy.visualThemeKey];

  if (therapy.benefits.length === 0) {
    return (
      <article className="rounded-hero border border-border bg-surface-elevated p-6 shadow-card sm:p-7">
        <h2 className={`text-[22px] font-extrabold ${visualTheme.accent}`}>
          Benefícios em curadoria
        </h2>
        <p className="mt-3 text-base font-semibold leading-7 text-tesText-secondary">
          A equipe TES ainda está revisando os benefícios públicos desta
          terapia. Você já pode conhecer profissionais relacionados quando
          houver serviços ativos.
        </p>
      </article>
    );
  }

  return (
    <article className="rounded-hero border border-border bg-surface-elevated p-5 shadow-card sm:p-7">
      <h2 className={`text-[22px] font-extrabold ${visualTheme.accent}`}>
        Benefícios que você pode sentir
      </h2>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {therapy.benefits.map((benefit) => (
          <div
            key={`${benefit.iconKey}-${benefit.title}`}
            className="flex min-h-[150px] flex-col items-center justify-center rounded-md border border-border bg-white/80 px-3 py-5 text-center shadow-[0_8px_22px_rgba(38,20,51,0.04)]"
          >
            <span
              className={`flex size-[58px] shrink-0 items-center justify-center rounded-full ${visualTheme.benefitIcon}`}
            >
              <DetailIcon iconKey={benefit.iconKey} />
            </span>
            <strong className="mt-4 block text-[13px] font-extrabold leading-5 text-brand-primary sm:text-sm">
              {benefit.title}
            </strong>
          </div>
        ))}
      </div>
    </article>
  );
}
