"use client";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  Clock3,
  LockKeyhole,
  MessageCircle,
  Star,
} from "lucide-react";

import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageMain,
  AppPageSection,
} from "@/components/app-page";
import { TESDecorativeMedia } from "@/components/tes";
import { formatSessionDateTime } from "@/features/bookings";
import { platformAssets } from "@/lib/platform-assets";
import { routes } from "@/lib/routes";

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

type TherapistReviewsSurface = "public" | "session";

export function TherapistReviewsPage({
  initialData,
  initialSurface = "public",
}: {
  initialData: TherapistReviewsPageData;
  initialSurface?: TherapistReviewsSurface;
}) {
  const [data, setData] = useState(initialData);
  const [filter, setFilter] = useState<TherapistReviewFilter>("all");
  const [surface, setSurface] =
    useState<TherapistReviewsSurface>(initialSurface);
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
        : "Resposta publicada no seu perfil público.",
    );
    return null;
  }

  return (
    <AppPageContainer className="gap-5">
      <div aria-live="polite" className="sr-only">
        {inlineMessage}
      </div>

      <ReviewsHero />

      <nav
        aria-label="Visões de avaliações"
        className="border-b border-brand-lavender"
      >
        <div
          className="flex gap-2 overflow-x-auto"
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
              return;
            }

            event.preventDefault();
            const nextSurface = surface === "public" ? "session" : "public";
            setSurface(nextSurface);
            document
              .getElementById(`therapist-reviews-${nextSurface}-tab`)
              ?.focus();
          }}
          role="tablist"
        >
          <SurfaceTab
            active={surface === "public"}
            id="therapist-reviews-public-tab"
            label="Avaliações públicas"
            onSelect={() => setSurface("public")}
            panelId="therapist-reviews-public-panel"
          />
          <SurfaceTab
            active={surface === "session"}
            count={data.pendingConfirmations.length}
            id="therapist-reviews-session-tab"
            label="Avaliações da sessão"
            onSelect={() => setSurface("session")}
            panelId="therapist-reviews-session-panel"
          />
        </div>
      </nav>

      {surface === "public" ? (
        <section
          aria-labelledby="therapist-reviews-public-tab"
          id="therapist-reviews-public-panel"
          role="tabpanel"
        >
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
              className="mt-5 rounded-card border border-status-success/30 bg-status-successBg p-4 text-sm font-bold leading-6 text-status-success"
              role="status"
            >
              {inlineMessage}
            </div>
          ) : null}

          <PublicReviewsPanel
            data={data}
            filter={filter}
            hasMore={hasMore}
            onLoadMore={() => setVisibleCount((current) => current + 5)}
            onReply={setSelectedReview}
            onSelectFilter={(value) => {
              setFilter(value);
              setVisibleCount(5);
            }}
            reviewsCount={filteredReviews.length}
            visibleReviews={visibleReviews}
          />
        </section>
      ) : (
        <SessionReviewsPanel data={data} />
      )}

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

function PublicReviewsPanel({
  data,
  filter,
  hasMore,
  onLoadMore,
  onReply,
  onSelectFilter,
  reviewsCount,
  visibleReviews,
}: {
  data: TherapistReviewsPageData;
  filter: TherapistReviewFilter;
  hasMore: boolean;
  onLoadMore: () => void;
  onReply: (review: TherapistReviewItem) => void;
  onSelectFilter: (filter: TherapistReviewFilter) => void;
  reviewsCount: number;
  visibleReviews: TherapistReviewItem[];
}) {
  return (
    <AppPageGrid className="mt-5">
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
                {reviewsCount} avaliaç
                {reviewsCount === 1 ? "ão" : "ões"}
              </p>
            </div>
          </div>

          <div
            className="flex gap-2 overflow-x-auto border-b border-brand-lavender px-5 py-3 sm:px-6"
            aria-label="Filtros de avaliações públicas"
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
                    onSelectFilter(value);
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
                    onReply={() => onReply(review)}
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
                onClick={onLoadMore}
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
  );
}

function SurfaceTab({
  active,
  count,
  id,
  label,
  onSelect,
  panelId,
}: {
  active: boolean;
  count?: number;
  id: string;
  label: string;
  onSelect: () => void;
  panelId: string;
}) {
  return (
    <button
      aria-controls={panelId}
      aria-label={
        typeof count === "number"
          ? `${label}, ${count} confirmações pendentes`
          : label
      }
      aria-selected={active}
      className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary ${
        active
          ? "border-brand-primary text-brand-deep"
          : "border-transparent text-tesText-secondary hover:border-brand-lavender hover:text-brand-primary"
      }`}
      id={id}
      onClick={onSelect}
      role="tab"
      tabIndex={active ? 0 : -1}
      type="button"
    >
      {label}
      {typeof count === "number" ? (
        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-status-warningBg px-2 py-0.5 text-xs font-extrabold text-status-warning">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function SessionReviewsPanel({ data }: { data: TherapistReviewsPageData }) {
  return (
    <section
      aria-labelledby="therapist-reviews-session-tab"
      className="grid gap-5"
      id="therapist-reviews-session-panel"
      role="tabpanel"
    >
      <section
        aria-labelledby="pending-session-confirmations"
        className="scroll-mt-24 rounded-card border border-brand-lavender bg-white p-5 shadow-card sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-status-warningBg text-status-warning">
            <Clock3 aria-hidden="true" size={20} />
          </span>
          <div>
            <h2
              className="text-xl font-extrabold text-brand-deep"
              id="pending-session-confirmations"
            >
              Confirmações operacionais pendentes
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
              Esta obrigação existe em todos os planos. Sem sua resposta, a
              confirmação automática ocorre no vencimento de 30 dias.
            </p>
          </div>
        </div>
        {data.pendingConfirmations.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {data.pendingConfirmations.map((confirmation) => (
              <article
                className="rounded-xl border border-border p-4"
                key={confirmation.bookingId}
              >
                <h3 className="font-extrabold text-brand-deep">
                  {confirmation.patientName}
                </h3>
                <p className="mt-1 font-mono text-xs font-bold text-brand-primary">
                  Sessão #{confirmation.sessionReference}
                </p>
                <p className="mt-1 text-sm font-semibold text-tesText-secondary">
                  {confirmation.serviceTitle ?? "Sessão terapêutica"}
                </p>
                <p className="mt-2 text-sm font-semibold text-tesText-secondary">
                  {formatSessionDateTime(
                    confirmation.startsAt,
                    confirmation.timezone,
                  )}
                </p>
                <p className="mt-3 text-sm font-bold text-status-warning">
                  {remainingLabel(confirmation.remainingSeconds)}
                </p>
                <a
                  className="mt-4 inline-flex min-h-11 items-center rounded-full border border-brand-lavender px-4 text-sm font-extrabold text-brand-primary hover:bg-brand-lavenderSoft"
                  href={`${routes.therapist.sessionVideo(confirmation.bookingId)}?feedback=1`}
                >
                  Confirmar sessão
                </a>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm font-semibold text-tesText-muted">
            Nenhuma confirmação pendente.
          </p>
        )}
      </section>

      <section
        aria-labelledby="private-session-feedback"
        className="rounded-card border border-brand-lavender bg-white p-5 shadow-card sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
            <LockKeyhole aria-hidden="true" size={20} />
          </span>
          <div>
            <h2
              className="text-xl font-extrabold text-brand-deep"
              id="private-session-feedback"
            >
              Feedbacks privados das sessões
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
              Somente participantes autorizados e a equipe administrativa
              acessam estes relatos. As respostas do paciente não podem ser
              editadas.
            </p>
          </div>
        </div>
        {data.privateFeedback.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {data.privateFeedback.slice(0, 12).map((feedback) => (
              <article
                className="rounded-xl border border-border p-4"
                key={feedback.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-extrabold text-brand-deep">
                    {feedback.patientName}
                  </h3>
                  <span className="rounded-full bg-surface-soft px-3 py-1 text-xs font-extrabold text-tesText-secondary">
                    {feedback.authorRole === "patient"
                      ? "Paciente"
                      : "Sua resposta"}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-tesText-secondary">
                  {feedback.serviceTitle ?? "Sessão terapêutica"}
                </p>
                <p className="mt-3 text-sm font-bold text-brand-deep">
                  {feedback.outcome === "completed"
                    ? `Realizada${feedback.rating ? ` · ${feedback.rating}/5` : ""}`
                    : "Não realizada · análise necessária"}
                </p>
                {feedback.comment ? (
                  <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                    {feedback.comment}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm font-semibold text-tesText-muted">
            Os feedbacks privados aparecerão após as primeiras respostas.
          </p>
        )}
      </section>
    </section>
  );
}

function remainingLabel(seconds: number) {
  if (seconds <= 0)
    return "Prazo automático atingido; processamento horário pendente";
  const days = Math.ceil(seconds / 86_400);
  return `${days} ${days === 1 ? "dia restante" : "dias restantes"} até a confirmação automática`;
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
    <section className="relative isolate overflow-hidden rounded-card bg-white">
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
              Acompanhe as avaliações das pessoas sobre as sessões realizadas e
              fortaleça a confiança no seu trabalho.
            </p>
          </div>
        </div>

        <div className="relative min-h-[180px] overflow-hidden bg-brand-lavenderSoft sm:min-h-[220px]">
          <TESDecorativeMedia
            className="absolute inset-0"
            fade="left"
            objectPosition="right center"
            priority
            sizes="(min-width: 1024px) 44vw, 100vw"
            src={platformAssets.therapistReviewsHero.src}
          />
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
