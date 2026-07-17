import type { PublicTherapyDetail } from "../../types/therapy-detail";
import { DetailIcon } from "./detail-icons";

export function TherapyBenefits({ therapy }: { therapy: PublicTherapyDetail }) {
  if (therapy.benefits.length === 0) {
    return (
      <section className="mx-auto max-w-[1288px] px-5 pb-8 sm:px-8 lg:px-12">
        <div className="rounded-[14px] border border-[#e5e0f5] bg-white p-7 shadow-[0_10px_24px_rgba(89,56,173,0.10)]">
          <h2 className="text-[22px] font-extrabold text-[#0894ab]">
            Benefícios em curadoria
          </h2>
          <p className="mt-3 text-base font-semibold leading-7 text-[#3b3d80]">
            A equipe TES ainda está revisando os benefícios públicos desta
            terapia. Você já pode conhecer profissionais relacionados quando
            houver serviços ativos.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1288px] px-5 pb-8 sm:px-8 lg:px-12">
      <article className="rounded-[14px] border border-[#e5e0f5] bg-white p-7 shadow-[0_10px_24px_rgba(89,56,173,0.10)]">
        <h2 className="text-[22px] font-extrabold text-[#0894ab]">
          Benefícios que você pode sentir
        </h2>

        <div className="mt-7 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {therapy.benefits.map((benefit) => (
            <div
              key={`${benefit.iconKey}-${benefit.title}`}
              className="flex min-h-[88px] items-start gap-4"
            >
              <span className="flex size-[70px] shrink-0 items-center justify-center rounded-full bg-[#e5fafc] text-[#0f87bd]">
                <DetailIcon iconKey={benefit.iconKey} />
              </span>
              <span>
                <strong className="block text-[15px] font-extrabold leading-6 text-[#3b3d80]">
                  {benefit.title}
                </strong>
                {benefit.description ? (
                  <span className="mt-1 block text-sm font-semibold leading-6 text-[#6b669e]">
                    {benefit.description}
                  </span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
