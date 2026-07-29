import { MessageCircleReply, Star } from "lucide-react";

import { TESButton } from "@/components/tes";

import type { TherapistReviewItem } from "../therapist-reviews.types";

export function TherapistReviewCard({
  onReply,
  review,
}: {
  onReply: () => void;
  review: TherapistReviewItem;
}) {
  const responded = review.responseStatus === "responded";

  return (
    <article className="rounded-card border border-brand-lavender/60 bg-white p-4 shadow-card sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_150px]">
        <div className="min-w-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-xl font-extrabold text-brand-deep">
              {review.patientInitials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-xl font-extrabold leading-tight text-brand-deep">
                    {review.patientName}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {review.therapyName ? (
                      <span className="rounded-full bg-brand-cyanSoft px-3 py-1 text-xs font-extrabold text-status-info">
                        {review.therapyName}
                      </span>
                    ) : null}
                    {review.serviceTitle ? (
                      <span className="rounded-full bg-brand-lavenderSoft px-3 py-1 text-xs font-extrabold text-brand-primary">
                        {review.serviceTitle}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <RatingStars rating={review.rating} />
                  <time className="text-sm font-semibold text-tesText-muted">
                    {review.publishedLabel}
                  </time>
                </div>
              </div>

              <p className="mt-5 text-sm font-semibold leading-6 text-tesText-secondary">
                {review.comment}
              </p>

              {review.reply ? (
                <div className="mt-5 rounded-card border border-brand-lavender bg-brand-lavenderSoft/40 p-4">
                  <p className="text-sm font-extrabold text-brand-deep">
                    Sua resposta
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                    {review.reply.body}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:items-end lg:justify-center">
          <span
            className={`inline-flex min-h-9 items-center justify-center rounded-lg px-3 text-sm font-extrabold ${
              responded
                ? "bg-status-successBg text-status-success"
                : "bg-status-warningBg text-status-warning"
            }`}
          >
            {responded ? "Respondida" : "Pendente"}
          </span>
          <TESButton
            className="min-h-11 rounded-lg"
            onClick={onReply}
            type="button"
            variant="secondary"
          >
            <MessageCircleReply aria-hidden="true" size={18} />
            {responded ? "Ver resposta" : "Responder"}
          </TESButton>
        </div>
      </div>
    </article>
  );
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span
      aria-label={`${rating} de 5 estrelas`}
      className="flex text-status-warning"
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          aria-hidden="true"
          className={`size-4 ${index < rating ? "fill-current" : "opacity-30"}`}
          key={index}
        />
      ))}
    </span>
  );
}
