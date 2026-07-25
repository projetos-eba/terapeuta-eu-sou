import type { PublicTherapyDetail } from "../../types/therapy-detail";
import { DetailIcon } from "./detail-icons";
import { therapyVisualThemes } from "./therapy-visual-theme";

export function TherapyFaq({ therapy }: { therapy: PublicTherapyDetail }) {
  const visualTheme = therapyVisualThemes[therapy.visualThemeKey];

  return (
    <article className="rounded-[28px] border border-[#e5e0f5] bg-white p-6 shadow-[0_18px_54px_rgba(38,20,51,0.08)] sm:p-8">
      <div className="flex items-center gap-3">
        <span
          className={`flex size-12 shrink-0 items-center justify-center rounded-full ${visualTheme.benefitIcon}`}
        >
          <DetailIcon iconKey="sparkles" />
        </span>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#7b4ba0]">
            Perguntas frequentes
          </p>
          <h2 className="mt-1 text-2xl font-extrabold text-brand-deep">
            Antes de seguir
          </h2>
        </div>
      </div>

      {therapy.faqs.length > 0 ? (
        <div className="mt-6 space-y-3">
          {therapy.faqs.map((faq, index) => (
            <details
              key={`${faq.question}-${index}`}
              className="group rounded-[18px] border border-[#eee7f8] bg-[#fbf8ff] p-4"
              open={index === 0}
            >
              <summary className="cursor-pointer list-none text-base font-extrabold text-[#3b2a63] marker:hidden">
                {faq.question}
              </summary>
              <p className="mt-3 text-sm font-semibold leading-7 text-[#6c6698]">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-base font-semibold leading-7 text-[#6c6698]">
          As perguntas desta terapia ainda estão em curadoria editorial.
        </p>
      )}
    </article>
  );
}
