"use client";

import { useEffect, useMemo, useState } from "react";
import { Heart, MessageCircleHeart, Star } from "lucide-react";

import type { TherapistProfileReview } from "../types";

export function ReviewsCarousel({
  average,
  count,
  reviews,
}: {
  average: number | null;
  count: number;
  reviews: TherapistProfileReview[];
}) {
  const pages = useMemo(() => {
    if (!reviews.length) return [[]];
    const chunks: TherapistProfileReview[][] = [];
    for (let index = 0; index < reviews.length; index += 2) {
      chunks.push(reviews.slice(index, index + 2));
    }
    return chunks;
  }, [reviews]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (pages.length <= 1) return;

    const id = window.setInterval(() => {
      setPage((current) => (current + 1) % pages.length);
    }, 5000);

    return () => window.clearInterval(id);
  }, [pages.length]);

  const visibleReviews = pages[page] ?? [];
  const [expandedReplies, setExpandedReplies] = useState<
    Record<string, boolean>
  >({});

  return (
    <section className="max-h-none overflow-visible rounded-[22px] border border-brand-lavender bg-white p-6 shadow-card sm:p-7 lg:max-h-[620px] lg:overflow-y-auto">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-[24px] font-light italic text-status-info">
          Avaliações
        </h2>
        <button className="min-h-11 rounded-full border border-border px-5 py-2 text-sm font-medium text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">
          Ver todas as avaliações →
        </button>
      </div>

      {count === 0 ? (
        <div className="mt-6 grid min-h-[330px] place-items-center rounded-[24px] bg-brand-lavenderSoft/60 px-5 py-10 text-center">
          <div>
            <span className="relative mx-auto grid size-28 place-items-center rounded-full border border-brand-primary/50 bg-white text-brand-primary shadow-card">
              <MessageCircleHeart aria-hidden="true" className="size-14" />
              <Heart
                aria-hidden="true"
                className="absolute -right-2 -top-2 size-5 fill-current text-brand-primary"
              />
            </span>
            <p className="mt-7 text-lg font-extrabold leading-7 text-brand-deep">
              Este perfil ainda não tem avaliações publicadas.
            </p>
            <p className="mt-3 text-base font-medium leading-7 text-brand-primary">
              As avaliações aparecem somente após sessão paga, concluída e
              aprovada pela moderação.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-end gap-4">
            <p className="font-display text-[48px] font-light italic leading-none text-brand-deep">
              {average?.toLocaleString("pt-BR", {
                maximumFractionDigits: 1,
                minimumFractionDigits: 1,
              })}
            </p>
            <div className="mb-2 flex text-status-warning">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} className="size-4 fill-current" />
              ))}
            </div>
            <p className="mb-2 text-sm font-medium leading-6 text-tesText-secondary">
              Com base em {count} experiência{count === 1 ? "" : "s"}{" "}
              compartilhada
              {count === 1 ? "" : "s"}.
            </p>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {visibleReviews.map((review) => (
              <article
                key={review.id}
                className="flex min-h-[300px] flex-col rounded-[30px] border border-brand-lavender p-[18px]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex text-status-warning">
                    {Array.from({ length: review.rating }).map((_, index) => (
                      <Star key={index} className="size-4 fill-current" />
                    ))}
                  </div>
                  <p className="text-xs font-medium text-tesText-muted">
                    {review.createdLabel}
                  </p>
                </div>
                <p className="mt-4 text-sm font-medium leading-[1.5] text-tesText-secondary">
                  {review.body}
                </p>
                {review.reply ? (
                  <div className="mt-4 rounded-2xl bg-brand-lavenderSoft/70 p-4">
                    <p className="text-sm font-extrabold text-brand-deep">
                      Resposta do terapeuta
                    </p>
                    <p className="mt-2 text-sm font-medium leading-6 text-tesText-secondary">
                      {expandedReplies[review.id]
                        ? review.reply.body
                        : getReplyPreview(review.reply.body)}
                    </p>
                    {getReplyPreview(review.reply.body) !==
                    review.reply.body ? (
                      <button
                        type="button"
                        className="mt-2 text-xs font-extrabold text-brand-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                        aria-expanded={Boolean(expandedReplies[review.id])}
                        onClick={() =>
                          setExpandedReplies((current) => ({
                            ...current,
                            [review.id]: !current[review.id],
                          }))
                        }
                      >
                        {expandedReplies[review.id]
                          ? "Mostrar menos"
                          : "Ler resposta completa"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-auto border-t border-border pt-4">
                  <p className="text-sm font-semibold text-brand-deep">
                    {review.authorLabel}
                  </p>
                  <p className="mt-1 text-xs text-tesText-secondary">
                    {review.patientContext}
                  </p>
                </div>
              </article>
            ))}
          </div>

          {pages.length > 1 ? (
            <div className="mt-4 flex justify-center gap-2">
              {pages.map((_, index) => (
                <button
                  key={index}
                  aria-label={`Ver página ${index + 1} de avaliações`}
                  className={`size-11 rounded-full ${
                    index === page ? "bg-brand-primary" : "bg-brand-lavender"
                  }`}
                  onClick={() => setPage(index)}
                />
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function getReplyPreview(value: string) {
  const trimmed = value.trim();
  const firstSentence = trimmed.match(/^.+?[.!?](?:\s|$)/u)?.[0]?.trim();
  if (firstSentence) return firstSentence;
  if (trimmed.length <= 110) return trimmed;
  return `${trimmed.slice(0, 107).trimEnd()}...`;
}
