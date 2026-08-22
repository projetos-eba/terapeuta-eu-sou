import Link from "next/link";
import type { Route } from "next";
import {
  AlertCircle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  HeartHandshake,
  MessageSquareReply,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";

import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageMain,
  AppPageSection,
} from "@/components/app-page";
import { TESCard } from "@/components/tes";
import { routes } from "@/lib/routes";

import { dismissAuraRecommendationAction } from "../therapist-aura.actions";
import type {
  AuraRecommendationTone,
  TherapistAuraPageData,
} from "../therapist-aura.types";

const toneStyles: Record<AuraRecommendationTone, string> = {
  attention: "bg-status-warningBg text-brand-deep",
  care: "bg-brand-lavenderSoft text-brand-deep",
  opportunity: "bg-brand-cyanSoft text-brand-deep",
};

export function TherapistAuraPage({ data }: { data: TherapistAuraPageData }) {
  return (
    <AppPageContainer className="gap-5">
      <section className="overflow-hidden rounded-panel border border-brand-lavender bg-[linear-gradient(135deg,#FAF7FC_0%,#F6FBFE_54%,#FFF6E8_100%)] p-5 shadow-card sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex min-h-8 items-center gap-2 rounded-full bg-white/80 px-3 text-xs font-extrabold text-brand-primary ring-1 ring-brand-lavender">
              <Sparkles aria-hidden="true" size={15} />
              Assessor Aura · Premium Plus
            </span>
            <h1 className="mt-5 max-w-3xl font-display text-[38px] font-light italic leading-tight text-brand-deep sm:text-[52px]">
              Sinais objetivos para cuidar da sua presença.
            </h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
              A Aura cruza apenas dados operacionais agregados da sua própria
              jornada. Não há chat, análise de texto livre, diagnóstico ou
              promessa de resultado.
            </p>
          </div>
          <div className="rounded-2xl bg-white/80 p-4 text-sm font-bold leading-6 text-brand-deep ring-1 ring-brand-lavender">
            <p>Período: últimos {data.meta.periodDays} dias completos</p>
            <p className="text-tesText-secondary">
              Atualizado em {formatDateTime(data.meta.computedAt)}
            </p>
          </div>
        </div>
      </section>

      <AppPageGrid>
        <AppPageMain>
          <section aria-labelledby="aura-recommendations-title">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  className="font-display text-[30px] font-light italic leading-tight text-brand-deep sm:text-[38px]"
                  id="aura-recommendations-title"
                >
                  Recomendações do momento
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                  Cada sugestão mostra os dados que levaram a ela e um próximo
                  passo.
                </p>
              </div>
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                href={`${routes.therapist.assessorIa}?period=${
                  data.meta.periodDays === 30 ? "90" : "30"
                }`}
              >
                Ver {data.meta.periodDays === 30 ? "90" : "30"} dias
              </Link>
            </div>

            {data.recommendations.length ? (
              <div className="grid gap-4">
                {data.recommendations.map((recommendation) => (
                  <TESCard
                    as="article"
                    className="grid gap-5 p-5 sm:p-6"
                    key={recommendation.id}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex gap-4">
                        <span
                          className={`grid size-12 shrink-0 place-items-center rounded-full ${toneStyles[recommendation.tone]}`}
                        >
                          <RecommendationIcon
                            routeKey={recommendation.actionRouteKey}
                          />
                        </span>
                        <div>
                          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-brand-primary">
                            Por que estamos sugerindo
                          </p>
                          <h3 className="mt-1 text-xl font-extrabold leading-tight text-brand-deep">
                            {recommendation.title}
                          </h3>
                        </div>
                      </div>
                      <form action={dismissAuraRecommendationAction}>
                        <input
                          name="recommendationKey"
                          type="hidden"
                          value={recommendation.id}
                        />
                        <input
                          name="ruleKey"
                          type="hidden"
                          value={recommendation.ruleKey}
                        />
                        <input
                          name="ruleVersion"
                          type="hidden"
                          value={recommendation.ruleVersion}
                        />
                        <input
                          name="periodStart"
                          type="hidden"
                          value={data.meta.periodStart}
                        />
                        <input
                          name="periodEnd"
                          type="hidden"
                          value={data.meta.periodEnd}
                        />
                        <button
                          className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-extrabold text-tesText-secondary transition hover:bg-brand-lavenderSoft hover:text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                          type="submit"
                        >
                          <Trash2 aria-hidden="true" size={16} />
                          Dispensar
                        </button>
                      </form>
                    </div>

                    <p className="max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary">
                      {recommendation.body}
                    </p>

                    <div className="flex flex-col gap-3 border-t border-brand-lavender pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs font-bold leading-5 text-tesText-muted">
                        {recommendation.evidenceLabel}
                      </p>
                      <Link
                        className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                        href={recommendation.actionHref as Route<string>}
                      >
                        {recommendation.actionLabel}
                      </Link>
                    </div>
                  </TESCard>
                ))}
              </div>
            ) : (
              <AppPageSection className="grid gap-4">
                <span className="grid size-12 place-items-center rounded-full bg-status-successBg text-status-success">
                  <CheckCircle2 aria-hidden="true" size={24} />
                </span>
                <div>
                  <h3 className="text-xl font-extrabold text-brand-deep">
                    Nenhum sinal prioritário agora
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary">
                    O Assessor Aura não encontrou uma ação prioritária entre os
                    dados disponíveis. Seus resultados continuam disponíveis
                    para acompanhamento.
                  </p>
                </div>
                <Link
                  className="inline-flex min-h-11 w-fit items-center justify-center rounded-full bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                  href={routes.therapist.insights as Route<string>}
                >
                  Ver resultados
                </Link>
              </AppPageSection>
            )}
          </section>
        </AppPageMain>

        <AppPageAside>
          <SignalSummary data={data} />
          <AppPageSection>
            <Sparkles aria-hidden="true" className="text-brand-primary" />
            <h2 className="mt-4 text-base font-extrabold text-brand-deep">
              Como o Assessor Aura ajuda
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              O Assessor Aura olha indicadores do seu trabalho e explica de onde
              cada sugestão veio. Ele não lê conversas, comentários privados ou
              conteúdos clínicos.
            </p>
          </AppPageSection>
        </AppPageAside>
      </AppPageGrid>
    </AppPageContainer>
  );
}

export function TherapistAuraErrorState({ message }: { message: string }) {
  return (
    <AppPageContainer>
      <AppPageSection className="grid gap-5">
        <span className="grid size-12 place-items-center rounded-full bg-status-dangerBg text-status-danger">
          <AlertCircle aria-hidden="true" size={24} />
        </span>
        <div>
          <h1 className="font-display text-[34px] font-light italic leading-tight text-brand-deep sm:text-[46px]">
            Assessor Aura indisponível
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
            {message}
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 w-fit items-center justify-center rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={routes.therapist.home}
        >
          Voltar ao painel
        </Link>
      </AppPageSection>
    </AppPageContainer>
  );
}

function SignalSummary({ data }: { data: TherapistAuraPageData }) {
  const rows = [
    {
      icon: CalendarClock,
      label: "Agenda",
      value:
        data.signals.bookingReadiness.status === "empty"
          ? "Nenhuma terapia disponível"
          : `${data.signals.bookingReadiness.servicesWithFutureAvailability}/${data.signals.bookingReadiness.publicBookableServices} com horários`,
    },
    {
      icon: MessageSquareReply,
      label: "Avaliações",
      value: `${data.signals.reviews.pendingReplyCount} sem resposta`,
    },
    {
      icon: BarChart3,
      label: "Cancelamentos",
      value: summarizeRate(data.signals.sessions.cancellationRate),
    },
    {
      icon: RotateCcw,
      label: "Ausências",
      value: summarizeRate(data.signals.sessions.noShowRate),
    },
    {
      icon: HeartHandshake,
      label: "Retorno",
      value: summarizeRate(data.signals.continuity.returnRate),
    },
  ] as const;

  return (
    <AppPageSection>
      <h2 className="text-base font-extrabold text-brand-deep">
        Sinais analisados
      </h2>
      <dl className="mt-4 grid gap-3">
        {rows.map(({ icon: Icon, label, value }) => (
          <div
            className="flex items-center gap-3 rounded-2xl border border-brand-lavender bg-white px-3 py-3"
            key={label}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
              <Icon aria-hidden="true" size={18} />
            </span>
            <div>
              <dt className="text-xs font-extrabold uppercase tracking-[0.1em] text-tesText-muted">
                {label}
              </dt>
              <dd className="text-sm font-extrabold text-brand-deep">
                {value}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </AppPageSection>
  );
}

function RecommendationIcon({
  routeKey,
}: {
  routeKey: TherapistAuraPageData["recommendations"][number]["actionRouteKey"];
}) {
  const icons = {
    agenda: CalendarClock,
    insights: HeartHandshake,
    profile: Sparkles,
    reviews: MessageSquareReply,
    services: BarChart3,
    sessions: RotateCcw,
  } as const;
  const Icon = icons[routeKey];
  return <Icon aria-hidden="true" size={22} />;
}

function summarizeRate(
  rate: TherapistAuraPageData["signals"]["sessions"]["cancellationRate"],
) {
  if (rate.status === "insufficient_sample") {
    return `Dados disponíveis: ${rate.observedSample}/${rate.minimumSample}`;
  }

  return rate.value === null
    ? "Sem base"
    : `${new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: 1,
      }).format(rate.value)}%`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
