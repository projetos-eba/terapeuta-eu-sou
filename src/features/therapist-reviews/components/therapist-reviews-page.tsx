"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { AlertCircle, MessageCircle, Star } from "lucide-react";

import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageMain,
  AppPageSection,
} from "@/components/app-page";

import {
  createStableRequestId,
  sendTherapistReviewCommand,
} from "../therapist-reviews.commands";
import type {
  TherapistReviewFilter,
  TherapistReviewItem,
  TherapistReviewsPageData,
} from "../therapist-reviews.types";
import { ReviewReplyDialog } from "./therapist-reviews-reply-dialog";
import { TherapistReviewCard } from "./therapist-review-card";
import { TherapistReviewMetricCard } from "./therapist-review-metric-card";
import { TherapistReviewsSidebar } from "./therapist-reviews-sidebar";

const filterLabels: Record<TherapistReviewFilter, string> = {
  all: "Todas",
  pending: "Pendentes de resposta",
  rating: "Por nota",
  recent: "Recentes",
};

export function TherapistReviewsPage({
  initialData,
}: {
  initialData: TherapistReviewsPageData;
}) {
  const [data, setData] = useState(initialData);
  const [filter, setFilter] = useState<TherapistReviewFilter>("all");
  const [visibleCount, setVisibleCount] = useState(5);
  const [selectedReview, setSelectedReview] =
    useState<TherapistReviewItem | null>(null);
  const [inlineMessage, setInlineMessage] = useState("");

  const filteredReviews = useMemo(() => {
    const reviews = [...data.reviews];

    if (filter === "pending") {
      return reviews.filter((review) => review.responseStatus === "pending");
    }

    if (filter === "recent") {
      const threshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
      return reviews
        .filter((review) => Date.parse(review.publishedAt ?? "") >= threshold)
        .sort((first, second) =>
          compareDates(second.publishedAt, first.publishedAt),
        );
    }

    if (filter === "rating") {
      return reviews.sort(
        (first, second) =>
          second.rating - first.rating ||
          compareDates(second.publishedAt, first.publishedAt),
      );
    }

    return reviews.sort((first, second) =>
      compareDates(second.publishedAt, first.publishedAt),
    );
  }, [data.reviews, filter]);

  const visibleReviews = filteredReviews.slice(0, visibleCount);
  const hasMore = visibleReviews.length < filteredReviews.length;

  async function submitReply(review: TherapistReviewItem, body: string) {
    const result = await sendTherapistReviewCommand({
      action: "reply",
      body,
      requestId: createStableRequestId(),
      reviewId: review.id,
    });

    if (result.status === "error") {
      return result.error.message;
    }

    setData(result.data.page);
    setSelectedReview(null);
    setInlineMessage(
      result.data.idempotentReplay
        ? "Resposta já estava registrada."
        : "Resposta publicada e sincronizada com o perfil público.",
    );
    return null;
  }

  return (
    <AppPageContainer className="gap-5">
      <div aria-live="polite" className="sr-only">
        {inlineMessage}
      </div>

      <ReviewsHero />

      <section
        aria-label="Indicadores das avaliações"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {data.metricCards.map((metric) => (
          <TherapistReviewMetricCard key={metric.key} metric={metric} />
        ))}
      </section>

      {inlineMessage ? (
        <div
          className="rounded-card border border-status-success/30 bg-status-successBg p-4 text-sm font-bold leading-6 text-status-success"
          role="status"
        >
          {inlineMessage}
        </div>
      ) : null}

      <AppPageGrid>
        <AppPageMain>
          <AppPageSection className="overflow-hidden p-0">
            <div className="border-b border-brand-lavender px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-brand-deep sm:text-2xl">
                    Avaliações recebidas
                  </h2>
                  <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                    Leia os retornos publicados e responda quando fizer sentido.
                  </p>
                </div>
                <p className="text-sm font-bold text-tesText-muted">
                  {filteredReviews.length} avaliaç
                  {filteredReviews.length === 1 ? "ão" : "ões"}
                </p>
              </div>
            </div>

            <div
              className="flex gap-2 overflow-x-auto border-b border-brand-lavender px-5 py-3 sm:px-6"
              role="tablist"
            >
              {Object.entries(filterLabels).map(([key, label]) => {
                const value = key as TherapistReviewFilter;
                const count =
                  value === "pending" ? data.metrics.pendingReplies : null;

                return (
                  <button
                    aria-selected={filter === value}
                    className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary ${
                      filter === value
                        ? "bg-brand-primary text-white"
                        : "text-brand-primary hover:bg-brand-lavenderSoft"
                    }`}
                    key={value}
                    onClick={() => {
                      setFilter(value);
                      setVisibleCount(5);
                    }}
                    role="tab"
                    type="button"
                  >
                    {label}
                    {count !== null ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          filter === value
                            ? "bg-white/20 text-white"
                            : "bg-brand-lavenderSoft text-brand-primary"
                        }`}
                      >
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 p-5 sm:p-6">
              {visibleReviews.length ? (
                <div className="grid gap-4">
                  {visibleReviews.map((review) => (
                    <TherapistReviewCard
                      key={review.id}
                      onReply={() => setSelectedReview(review)}
                      review={review}
                    />
                  ))}
                </div>
              ) : (
                <ReviewsEmptyState filter={filter} />
              )}

              {hasMore ? (
                <button
                  className="mx-auto inline-flex min-h-11 min-w-[260px] items-center justify-center rounded-lg border border-brand-lavender bg-white px-5 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                  onClick={() => setVisibleCount((current) => current + 5)}
                  type="button"
                >
                  Carregar mais avaliações
                </button>
              ) : null}
            </div>
          </AppPageSection>
        </AppPageMain>

        <AppPageAside>
          <TherapistReviewsSidebar data={data} />
        </AppPageAside>
      </AppPageGrid>

      {selectedReview ? (
        <ReviewReplyDialog
          onClose={() => setSelectedReview(null)}
          onSubmit={submitReply}
          review={selectedReview}
        />
      ) : null}
    </AppPageContainer>
  );
}

export function TherapistReviewsErrorState({
  message,
  requestId,
}: {
  message: string;
  requestId?: string;
}) {
  return (
    <AppPageContainer>
      <AppPageSection className="grid gap-4">
        <span className="grid size-12 place-items-center rounded-full bg-status-dangerBg text-status-danger">
          <AlertCircle aria-hidden="true" size={24} />
        </span>
        <div>
          <h1 className="font-display text-[34px] font-light italic leading-tight text-brand-deep sm:text-[46px]">
            Avaliações indisponíveis
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
            {message}
          </p>
          {requestId ? (
            <p className="mt-3 text-sm font-semibold leading-6 text-tesText-muted">
              Código de atendimento: {requestId}
            </p>
          ) : null}
        </div>
      </AppPageSection>
    </AppPageContainer>
  );
}

function ReviewsHero() {
  return (
    <section className="overflow-hidden rounded-card border border-brand-lavender bg-white">
      <div className="grid min-h-[236px] lg:grid-cols-[minmax(0,1fr)_minmax(360px,44%)]">
        <div className="flex items-center px-5 py-8 sm:px-8 lg:px-10">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-primary">
              Reputação profissional
            </p>
            <h1 className="mt-3 font-display text-[42px] font-light italic leading-[0.95] text-brand-deep sm:text-[58px]">
              Avaliações
            </h1>
            <p className="mt-4 max-w-[540px] text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
              Acompanhe as avaliações das pessoas sobre os encontros realizados
              e fortaleça a confiança no seu trabalho.
            </p>
          </div>
        </div>

        <div className="relative min-h-[180px] overflow-hidden bg-brand-lavenderSoft sm:min-h-[220px]">
          <Image
            alt=""
            className="object-cover object-center opacity-90"
            fill
            priority
            sizes="(min-width: 1024px) 44vw, 100vw"
            src="/home/step-crystal.png"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-white/30 to-transparent lg:from-white/45" />
        </div>
      </div>
    </section>
  );
}

function ReviewsEmptyState({ filter }: { filter: TherapistReviewFilter }) {
  const isPending = filter === "pending";

  return (
    <div className="rounded-card border border-dashed border-brand-lavender bg-brand-lavenderSoft/40 p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-brand-primary">
          {isPending ? (
            <MessageCircle aria-hidden="true" size={22} />
          ) : (
            <Star aria-hidden="true" size={22} />
          )}
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-brand-deep">
            {isPending
              ? "Nenhuma avaliação pendente de resposta"
              : "Ainda sem avaliações neste filtro"}
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            {isPending
              ? "Quando uma avaliação publicada ainda não tiver resposta, ela aparecerá aqui."
              : "Avaliações aparecem somente após sessão online paga, concluída e publicada."}
          </p>
        </div>
      </div>
    </div>
  );
}

function compareDates(first: string | null, second: string | null) {
  return Date.parse(first ?? "1970-01-01") - Date.parse(second ?? "1970-01-01");
}
