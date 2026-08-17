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
      <AppPageSection className="grid gap-6">
        <div>
          <h2 className="font-display text-[32px] font-light italic leading-tight text-brand-deep">
            Resumo das avaliações
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            Distribuição das avaliações publicadas.
          </p>
        </div>

        <div className="grid gap-4">
          {data.distribution.map((item) => {
            const percent =
              total > 0 ? Math.round((item.count / total) * 100) : 0;

            return (
              <div
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3"
                key={item.rating}
              >
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-extrabold text-brand-deep">
                  {item.rating} estrela{item.rating === 1 ? "" : "s"}
                  <Star
                    aria-hidden="true"
                    className="size-3.5 fill-current text-status-warning"
                  />
                </span>
                <div
                  aria-label={`${percent}% das avaliações têm ${item.rating} estrelas`}
                  className="h-2.5 overflow-hidden rounded-full bg-brand-lavenderSoft"
                  role="img"
                >
                  <div
                    className="h-full rounded-full bg-brand-primary"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="whitespace-nowrap text-right text-sm font-bold text-tesText-muted">
                  {item.count}
                </span>
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
          <h2 className="text-xl font-extrabold text-brand-deep">
            Como as avaliações ajudam seu perfil
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
    body: "Ajudam novas pessoas a conhecerem seu trabalho.",
    icon: MessageCircleHeart,
    title: "Fortalecem a confiança",
  },
  {
    body: "Facilitam a decisão de quem está buscando acolhimento.",
    icon: HeartHandshake,
    title: "Tornam sua apresentação mais clara",
  },
  {
    body: "Mostram como sua prática é percebida ao longo da jornada.",
    icon: UserRoundCheck,
    title: "Oferecem contexto para aprimorar",
  },
];
