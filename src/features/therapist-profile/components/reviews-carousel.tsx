"use client";

import { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";

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

  return (
    <section className="rounded-[22px] border border-[#e9ddf6] bg-white p-7">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-[24px] font-light italic text-[#639abe]">
          Avaliações
        </h2>
        <button className="rounded-full border border-[#ded5f2] px-5 py-2 text-sm font-medium text-brand-primary">
          Ver todas as avaliações →
        </button>
      </div>

      {count === 0 ? (
        <div className="mt-8 rounded-[24px] border border-[#cdbff0] p-6 text-sm font-medium leading-6 text-[#5e5a8a]">
          Este perfil ainda não tem avaliações publicadas. As avaliações aparecem
          somente após sessão paga, concluída e aprovada pela moderação.
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-end gap-4">
            <p className="font-display text-[48px] font-light italic leading-none text-[#21105f]">
              {average?.toLocaleString("pt-BR", {
                maximumFractionDigits: 1,
                minimumFractionDigits: 1,
              })}
            </p>
            <div className="mb-2 flex text-[#f4b84a]">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} className="size-4 fill-current" />
              ))}
            </div>
            <p className="mb-2 text-xs font-medium text-[#5e5a8a]">
              Com base em {count} experiência{count === 1 ? "" : "s"} compartilhada
              {count === 1 ? "" : "s"}.
            </p>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {visibleReviews.map((review) => (
              <article
                key={review.id}
                className="rounded-[30px] border border-[#cdbff0] p-[18px]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex text-[#f4b84a]">
                    {Array.from({ length: review.rating }).map((_, index) => (
                      <Star key={index} className="size-4 fill-current" />
                    ))}
                  </div>
                  <p className="text-[11px] font-medium text-[#8c87b2]">
                    {review.createdLabel}
                  </p>
                </div>
                <p className="mt-4 text-xs font-medium leading-[1.45] text-[#5e5a8a]">
                  {review.body}
                </p>
                <div className="mt-5 border-t border-[#e8e2f6] pt-4">
                  <p className="text-xs font-semibold text-[#453232]">
                    {review.authorLabel}
                  </p>
                  <p className="mt-1 text-[11px] text-[#5e5a8a]">
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
                  className={`size-2 rounded-full ${
                    index === page ? "bg-brand-primary" : "bg-[#ded5f2]"
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
