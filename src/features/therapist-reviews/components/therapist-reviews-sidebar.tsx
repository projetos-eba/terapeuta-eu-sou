import {
  HeartHandshake,
  MessageCircleHeart,
  Star,
  UserRoundCheck,
} from "lucide-react";

import { AppPageSection } from "@/components/app-page";

import type { TherapistReviewsPageData } from "../therapist-reviews.types";

export function TherapistReviewsSidebar({
  data,
}: {
  data: TherapistReviewsPageData;
}) {
  const total = data.metrics.totalReviews;

  return (
    <div className="grid gap-5">
      <AppPageSection className="grid gap-5">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-brand-primary">
            Resumo
          </p>
          <h2 className="mt-2 text-xl font-extrabold text-brand-deep">
            Resumo das avaliações
          </h2>
        </div>

        <div className="grid gap-3">
          {data.distribution.map((item) => {
            const percent =
              total > 0 ? Math.round((item.count / total) * 100) : 0;

            return (
              <div className="grid gap-2" key={item.rating}>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1 text-sm font-extrabold text-brand-deep">
                    {item.rating}
                    <Star
                      aria-hidden="true"
                      className="size-4 fill-current text-status-warning"
                    />
                  </span>
                  <span className="text-sm font-semibold text-tesText-muted">
                    {item.count} avaliação{item.count === 1 ? "" : "ões"}
                  </span>
                </div>
                <div
                  aria-label={`${percent}% das avaliações têm ${item.rating} estrelas`}
                  className="h-3 overflow-hidden rounded-full bg-brand-lavenderSoft"
                  role="img"
                >
                  <div
                    className="h-full rounded-full bg-brand-primary"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {total === 0 ? (
          <p className="rounded-card bg-brand-lavenderSoft/70 p-4 text-sm font-semibold leading-6 text-tesText-secondary">
            Ainda sem dados. Começaremos a mostrar a distribuição após as
            primeiras avaliações publicadas.
          </p>
        ) : null}
      </AppPageSection>

      <AppPageSection className="grid gap-5">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-brand-primary">
            Boas práticas
          </p>
          <h2 className="mt-2 text-xl font-extrabold text-brand-deep">
            A importância das avaliações
          </h2>
        </div>

        <div className="grid gap-4">
          {tips.map((tip) => (
            <article className="flex gap-3" key={tip.title}>
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
                <tip.icon aria-hidden="true" size={21} />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-brand-deep">
                  {tip.title}
                </h3>
                <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                  {tip.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </AppPageSection>
    </div>
  );
}

const tips = [
  {
    body: "Respostas breves e respeitosas ajudam a pessoa a se sentir escutada.",
    icon: MessageCircleHeart,
    title: "Responda com cuidado",
  },
  {
    body: "Evite dados privados e mantenha uma linguagem responsável, sem prometer resultados.",
    icon: HeartHandshake,
    title: "Proteja a privacidade",
  },
  {
    body: "Use os retornos publicados para aprimorar sua apresentação e sua rotina de atendimento online.",
    icon: UserRoundCheck,
    title: "Aprenda com os retornos",
  },
];
