import Link from "next/link";
import type { Route } from "next";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  HeartHandshake,
  MessageSquareReply,
  RotateCcw,
  Sparkles,
  Target,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import { AppPageContainer, AppPageSection } from "@/components/app-page";
import { TESDecorativeMedia } from "@/components/tes";
import { platformAssets } from "@/lib/platform-assets";
import { routes } from "@/lib/routes";

import { TherapistAuraDismissForm } from "./therapist-aura-dismiss-form";
import type {
  AuraRecommendationTone,
  AuraRuleRecommendation,
  TherapistAuraPageData,
} from "../therapist-aura.types";

const toneStyles: Record<
  AuraRecommendationTone,
  { badge: string; icon: string; button: string }
> = {
  attention: {
    badge: "bg-status-warningBg text-status-warning",
    button: "bg-status-warningBg text-brand-deep hover:bg-status-warningBg/80",
    icon: "bg-status-warningBg text-status-warning",
  },
  care: {
    badge: "bg-brand-cyanSoft text-brand-primary",
    button: "bg-brand-cyanSoft text-brand-deep hover:bg-brand-cyanSoft/80",
    icon: "bg-brand-cyanSoft text-brand-primary",
  },
  opportunity: {
    badge: "bg-brand-lavenderSoft text-brand-primary",
    button: "bg-brand-lavenderSoft text-brand-deep hover:bg-brand-lavender",
    icon: "bg-brand-lavenderSoft text-brand-primary",
  },
};

export function TherapistAuraPage({ data }: { data: TherapistAuraPageData }) {
  const recommendationCount = data.recommendations.length;
  const returnRate = data.signals.continuity.returnRate;
  const hasPendingReviewSignal =
    data.signals.reviews.status === "ready" &&
    data.signals.reviews.pendingReplyCount > 0;

  return (
    <AppPageContainer className="gap-5">
      <section className="relative isolate overflow-hidden rounded-panel border border-brand-lavender bg-gradient-to-r from-white via-brand-lavenderSoft to-brand-lavender shadow-card">
        <TESDecorativeMedia
          className="absolute inset-y-0 right-0 w-[58%] sm:w-[53%]"
          fade="left"
          fadeTone="soft"
          imageClassName="object-contain object-right-bottom"
          priority
          sizes="(min-width: 1024px) 56vw, 70vw"
          src={platformAssets.therapistAuraCharacter.src}
        />
        <div className="relative z-10 grid min-h-[296px] max-w-[630px] gap-5 p-6 sm:min-h-[320px] sm:p-9 lg:p-11">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-[42px] font-light italic leading-none text-brand-deep sm:text-[54px]">
                Assessora Aura
              </h1>
              <span className="inline-flex min-h-9 items-center rounded-full border border-brand-lavender bg-brand-lavenderSoft px-4 text-sm font-extrabold text-brand-primary">
                leitura por regras
              </span>
            </div>
            <p className="mt-6 max-w-[520px] text-sm font-semibold leading-6 text-brand-primary sm:text-base">
              A Assessora Aura analisa dados operacionais agregados da TES e
              organiza sinais práticos para você agir com mais clareza.
            </p>
          </div>
          <span className="inline-flex min-h-9 w-fit items-center gap-2 rounded-full border border-brand-lavender bg-white/90 px-4 text-sm font-extrabold text-tesText-secondary">
            <Sparkles
              aria-hidden="true"
              className="text-brand-primary"
              size={16}
            />
            Sinais calculados automaticamente
          </span>
        </div>
      </section>

      <section
        aria-labelledby="aura-numbers-title"
        className="rounded-card border border-brand-lavender bg-white p-4 shadow-card sm:p-6"
      >
        <div className="flex flex-col gap-4 border-b border-brand-lavender pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-brand-primary">
              Leitura da sua jornada
            </p>
            <h2
              className="mt-2 font-display text-[30px] font-light italic leading-tight text-brand-deep sm:text-[38px]"
              id="aura-numbers-title"
            >
              Seus números mais importantes
            </h2>
          </div>
          <div aria-label="Período analisado" className="flex flex-wrap gap-2">
            {[30, 90].map((period) => {
              const active = data.meta.periodDays === period;
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary ${
                    active
                      ? "border-brand-primary bg-brand-lavenderSoft text-brand-deep"
                      : "border-brand-lavender bg-white text-tesText-secondary hover:bg-brand-lavenderSoft"
                  }`}
                  href={`${routes.therapist.assessorIa}?period=${period}`}
                  key={period}
                >
                  {period} dias
                </Link>
              );
            })}
          </div>
        </div>
        <p className="mt-4 text-xs font-semibold leading-5 text-tesText-muted">
          Leitura calculada em {formatDateTime(data.meta.computedAt)} · período
          histórico encerrado em {formatDate(data.meta.periodEnd)} · fuso{" "}
          {data.meta.timezone}
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AuraKpiCard
            description="Recomendações elegíveis pelas regras da Aura."
            icon={Sparkles}
            label="Sinais do período"
            reference={!recommendationCount}
            value={String(recommendationCount)}
          />
          <AuraKpiCard
            description={`Avaliações publicadas sem resposta nos últimos ${data.signals.reviews.windowDays} dias completos.`}
            icon={MessageSquareReply}
            label="Avaliações pendentes"
            reference={!data.signals.reviews.pendingReplyCount}
            tone="mint"
            value={String(data.signals.reviews.pendingReplyCount)}
          />
          <AuraKpiCard
            description="Métricas com menos de 10 observações ficam protegidas."
            icon={Target}
            label="Amostras em formação"
            reference={!insufficientSampleCount(data)}
            tone="coral"
            value={String(insufficientSampleCount(data))}
          />
          <AuraKpiCard
            description="Amostra mínima: 10 pessoas acompanhadas."
            icon={RotateCcw}
            label="Taxa de retorno"
            reference={returnRate.status !== "ready"}
            value={formatRate(returnRate)}
          />
        </div>
      </section>

      <section aria-labelledby="aura-important-title">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              className="font-display text-[30px] font-light italic leading-tight text-brand-deep sm:text-[38px]"
              id="aura-important-title"
            >
              Leituras que merecem atenção
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              A Aura mostra o contexto e o próximo passo sem transformar sinais
              em promessa.
            </p>
          </div>
          <span className="text-sm font-bold text-tesText-secondary">
            Histórico: últimos {data.meta.periodDays} dias completos
          </span>
        </div>

        <div
          className={`grid gap-4 ${hasPendingReviewSignal ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}
        >
          <AuraContextCard
            actionHref={routes.therapist.finance}
            actionLabel="Ver financeiro"
            description="O Financeiro fica fora da leitura da Aura e separa realizado, contratado e estimado na área própria."
            icon={WalletCards}
            label="Financeiro"
            title="Acompanhe seus recebimentos em um só lugar"
            tone="care"
            value="Disponível no Financeiro"
          />
          {!hasPendingReviewSignal ? (
            <AuraContextCard
              actionHref={routes.therapist.reviews}
              actionLabel="Ver avaliações"
              description={growthDescription(data)}
              icon={BarChart3}
              label="Crescimento"
              title={growthTitle(data)}
              tone="attention"
              value={
                data.signals.reviews.status === "ready"
                  ? `${data.signals.reviews.pendingReplyCount} pendentes`
                  : "Em formação"
              }
            />
          ) : null}
          <AuraContextCard
            actionHref={routes.therapist.insights}
            actionLabel="Ver métricas"
            description={relationshipDescription(returnRate)}
            icon={HeartHandshake}
            label="Relacionamento"
            title={relationshipTitle(returnRate)}
            tone="opportunity"
            value={formatRate(returnRate)}
          />
        </div>
      </section>

      <section
        aria-labelledby="aura-recommendations-title"
        className="rounded-card border border-brand-lavender bg-white p-4 shadow-card sm:p-6"
      >
        <div className="flex flex-col gap-3 border-b border-brand-lavender pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Sparkles
                aria-hidden="true"
                className="text-brand-primary"
                size={25}
              />
              <h2
                className="font-display text-[30px] font-light italic leading-tight text-brand-deep sm:text-[38px]"
                id="aura-recommendations-title"
              >
                Recomendações da Aura
              </h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary">
              Ações práticas com base nos sinais agregados e auditáveis do seu
              perfil, agenda, avaliações e sessões.
            </p>
          </div>
        </div>

        {data.recommendations.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.recommendations.map((recommendation) => (
              <AuraRecommendationCard
                data={data}
                key={recommendation.id}
                recommendation={recommendation}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 grid gap-4 rounded-card border border-dashed border-brand-lavender bg-brand-lavenderSoft/45 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <span className="grid size-12 place-items-center rounded-full bg-white text-status-success">
              <CheckCircle2 aria-hidden="true" size={25} />
            </span>
            <div>
              <h3 className="text-lg font-extrabold text-brand-deep">
                Nenhum sinal prioritário agora
              </h3>
              <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                A estrutura de recomendações está pronta. Novas leituras
                aparecem quando houver sinais elegíveis no período.
              </p>
            </div>
          </div>
        )}
      </section>

      <AppPageSection
        aria-labelledby="aura-results-title"
        className="grid gap-5"
      >
        <div>
          <h2
            className="font-display text-[30px] font-light italic leading-tight text-brand-deep sm:text-[38px]"
            id="aura-results-title"
          >
            A Aura ajudando você todos os dias
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            Resultados calculados a partir das automações e sinais disponíveis
            para sua conta.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AuraResultMetric
            label="Sinais elegíveis"
            value={String(recommendationCount)}
          />
          <AuraResultMetric
            label="Período analisado"
            value={`${data.meta.periodDays} dias`}
          />
          <AuraResultMetric
            label="Avaliações sem resposta"
            value={String(data.signals.reviews.pendingReplyCount)}
          />
          <AuraResultMetric
            label="Retorno acompanhado"
            value={formatRate(returnRate)}
          />
        </div>
      </AppPageSection>
    </AppPageContainer>
  );
}

function AuraKpiCard({
  description,
  icon: Icon,
  label,
  reference = false,
  tone = "lavender",
  value,
}: {
  description: string;
  icon: LucideIcon;
  label: string;
  reference?: boolean;
  tone?: "coral" | "lavender" | "mint";
  value: string;
}) {
  const toneClass = {
    coral: "bg-status-dangerBg text-status-danger",
    lavender: "bg-brand-lavenderSoft text-brand-primary",
    mint: "bg-status-successBg text-status-success",
  }[tone];

  return (
    <article className="grid min-h-[174px] grid-rows-[auto_1fr_auto] rounded-card border border-brand-lavender bg-white p-4 shadow-card sm:min-h-[206px] sm:p-5">
      <div className="flex items-start gap-3">
        <span
          className={`grid size-12 shrink-0 place-items-center rounded-full ${toneClass}`}
        >
          <Icon aria-hidden="true" size={23} />
        </span>
        <h3 className="pt-1 text-base font-extrabold leading-5 text-brand-deep">
          {label}
        </h3>
      </div>
      <div className="mt-4">
        <p
          className={`text-[34px] font-extrabold leading-none ${reference ? "text-tesText-muted" : "text-brand-deep"}`}
        >
          {value}
        </p>
        <ReferenceBars
          label={`${label}: ${reference ? "ainda sem dados" : "visual ilustrativo"}`}
        />
      </div>
      <p className="mt-4 text-sm font-semibold leading-5 text-tesText-secondary">
        {description}
      </p>
    </article>
  );
}

function AuraContextCard({
  actionHref,
  actionLabel,
  description,
  icon: Icon,
  label,
  tone,
  title,
  value,
}: {
  actionHref: string;
  actionLabel: string;
  description: string;
  icon: LucideIcon;
  label: string;
  tone: AuraRecommendationTone;
  title: string;
  value: string;
}) {
  const style = toneStyles[tone];
  return (
    <article className="grid min-h-[224px] grid-rows-[auto_auto_1fr_auto] rounded-card border border-brand-lavender bg-white p-4 shadow-card sm:min-h-[270px] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`grid size-11 place-items-center rounded-full ${style.icon}`}
          >
            <Icon aria-hidden="true" size={21} />
          </span>
          <span className="text-sm font-extrabold uppercase tracking-[0.1em] text-brand-primary">
            {label}
          </span>
        </div>
        <span
          className={`rounded-lg px-3 py-1 text-xs font-extrabold ${style.badge}`}
        >
          {tone === "attention" ? "Atenção" : "Acompanhando"}
        </span>
      </div>
      <h3 className="mt-4 text-xl font-extrabold leading-6 text-brand-deep sm:mt-6">
        {title}
      </h3>
      <div className="mt-3">
        <p className="text-base font-extrabold text-brand-primary">{value}</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          {description}
        </p>
      </div>
      <Link
        className={`mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary ${style.button}`}
        href={actionHref as Route<string>}
      >
        {actionLabel}
        <ArrowRight aria-hidden="true" size={18} />
      </Link>
    </article>
  );
}

function AuraRecommendationCard({
  data,
  recommendation,
}: {
  data: TherapistAuraPageData;
  recommendation: AuraRuleRecommendation;
}) {
  const style = toneStyles[recommendation.tone];
  return (
    <article className="grid min-h-[216px] grid-rows-[auto_1fr_auto] rounded-card border border-brand-lavender bg-white p-4 shadow-card sm:min-h-[250px] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <span
          className={`grid size-11 place-items-center rounded-xl ${style.icon}`}
        >
          <RecommendationIcon routeKey={recommendation.actionRouteKey} />
        </span>
        <TherapistAuraDismissForm
          periodEnd={data.meta.periodEnd}
          periodStart={data.meta.periodStart}
          recommendationKey={recommendation.id}
          recommendationTitle={recommendation.title}
        />
      </div>
      <div className="mt-4">
        <p className="text-sm font-extrabold uppercase tracking-[0.1em] text-brand-primary">
          Recomendação
        </p>
        <h3 className="mt-2 text-lg font-extrabold leading-6 text-brand-deep">
          {recommendation.title}
        </h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          {recommendation.body}
        </p>
      </div>
      <div className="mt-5 grid gap-2">
        <p className="text-xs font-bold leading-5 text-tesText-muted">
          {recommendation.evidenceLabel}
        </p>
        <Link
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={recommendation.actionHref as Route<string>}
        >
          {recommendation.actionLabel}
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </div>
    </article>
  );
}

function AuraResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 rounded-card border border-brand-lavender bg-surface-soft p-4">
      <ReferenceBars label={`${label}: visual ilustrativo`} />
      <strong className="text-2xl font-extrabold text-brand-deep">
        {value}
      </strong>
      <span className="text-sm font-bold leading-5 text-tesText-secondary">
        {label}
      </span>
    </div>
  );
}

function ReferenceBars({ label }: { label: string }) {
  return (
    <div
      aria-label={`${label}. Não representa uma série histórica.`}
      className="flex h-8 items-end gap-1"
      role="img"
      tabIndex={0}
    >
      {[18, 28, 22, 34, 25, 30, 20].map((height, index) => (
        <span
          aria-hidden="true"
          className="w-2 rounded-t bg-brand-lavender"
          key={index}
          style={{ height: `${height}%` }}
        />
      ))}
      <span
        aria-hidden="true"
        className="ml-1 h-px flex-1 border-t border-dashed border-brand-lavender"
      />
    </div>
  );
}

function RecommendationIcon({
  routeKey,
}: {
  routeKey: AuraRuleRecommendation["actionRouteKey"];
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

function growthTitle(data: TherapistAuraPageData) {
  if (
    data.signals.reviews.status === "ready" &&
    data.signals.reviews.pendingReplyCount > 0
  ) {
    return "Sua presença tem avaliações esperando resposta";
  }
  return "Sua presença está pronta para ser acompanhada";
}

function growthDescription(data: TherapistAuraPageData) {
  if (
    data.signals.reviews.status === "ready" &&
    data.signals.reviews.pendingReplyCount > 0
  ) {
    return `Responder avaliações publicadas nos últimos ${data.signals.reviews.windowDays} dias ajuda a manter o cuidado depois da sessão e deixa esse espaço mais completo.`;
  }
  return "A Aura continua observando sinais agregados da sua jornada para indicar próximos passos quando houver base suficiente.";
}

function relationshipTitle(
  rate: TherapistAuraPageData["signals"]["continuity"]["returnRate"],
) {
  return rate.status === "ready"
    ? "A continuidade está sendo acompanhada"
    : "A continuidade ainda está em formação";
}

function relationshipDescription(
  rate: TherapistAuraPageData["signals"]["continuity"]["returnRate"],
) {
  return rate.status === "ready"
    ? "A taxa mostra o retorno observado na amostra mínima do período, sempre comparado ao seu próprio histórico."
    : `A leitura aparece quando houver pelo menos ${rate.minimumSample} pessoas elegíveis acompanhadas.`;
}

function formatRate(
  rate: TherapistAuraPageData["signals"]["continuity"]["returnRate"],
) {
  if (rate.status === "insufficient_sample") return "Em formação";
  if (rate.value === null) return "Sem base";
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(rate.value)}%`;
}

function insufficientSampleCount(data: TherapistAuraPageData) {
  return [
    data.signals.sessions.cancellationRate,
    data.signals.sessions.noShowRate,
    data.signals.continuity.returnRate,
  ].filter((rate) => rate.status === "insufficient_sample").length;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
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
            Assessora Aura indisponível
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
