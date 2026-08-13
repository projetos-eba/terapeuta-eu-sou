import Link from "next/link";
import type { Route } from "next";

import { routes } from "@/lib/routes";

import type { TherapistDashboardPageData } from "../therapist-dashboard.types";

export function TherapistRecentReviews({
  reviews,
}: {
  reviews: TherapistDashboardPageData["recentReviews"];
}) {
  return (
    <section className="flex min-h-[330px] flex-col rounded-panel border border-[var(--tes-color-border)]/70 bg-white p-6 shadow-card">
      <h2 className="max-w-xs text-xl font-bold leading-6 text-brand-deep">
        O que estão dizendo sobre seu cuidado
      </h2>
      {reviews.length ? (
        <ul className="mt-5 space-y-4">
          {reviews.slice(0, 3).map((review, index) => (
            <li className="flex gap-3" key={review.id}>
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${
                  ["bg-[#ef5b7a]", "bg-brand-primary", "bg-[#d1846b]"][
                    index % 3
                  ]
                }`}
              >
                {review.patientInitial}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-xs text-brand-deep">
                    {review.patientName} · {"★".repeat(review.rating)}
                  </strong>
                  <time className="text-[10px] text-tesText-muted md:text-[11px]">
                    {formatDate(review.publishedAt)}
                  </time>
                </div>
                <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-tesText-secondary">
                  {review.comment}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm leading-6 text-tesText-secondary">
          As avaliações publicadas aparecerão aqui.
        </p>
      )}
      <Link
        className="mt-auto pt-6 text-center text-xs font-bold text-brand-deep outline-none hover:text-brand-primary focus-visible:ring-4 focus-visible:ring-ring/20"
        href={routes.therapist.reviews as Route<string>}
      >
        Ver todas as avaliações →
      </Link>
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}
