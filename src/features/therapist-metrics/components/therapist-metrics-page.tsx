import Link from "next/link";
import {
  AlertCircle,
  CalendarCheck2,
  Clock3,
  Eye,
  Info,
  RefreshCw,
  Sparkles,
  Star,
  UsersRound,
} from "lucide-react";

import { AppPageContainer, AppPageSection } from "@/components/app-page";
import { TESCard } from "@/components/tes";
import { routes } from "@/lib/routes";

import { getTherapistMetricCopy } from "../therapist-metrics.copy";
import type {
  TherapistInterestMetrics,
  TherapistInterestMetricsReady,
  TherapistMetricsDashboard,
} from "../therapist-metrics.types";
import {
  DistributionDonut,
  JourneyFunnel,
  MetricSparkline,
  MetricsHeatmap,
  SessionsEvolutionChart,
  TherapyBarsChart,
} from "./therapist-metrics-charts";
import { formatMetricValue } from "./therapist-metric-card";
import { TherapistMetricsLayout } from "./therapist-metrics-layout";

export function TherapistMetricsPage({
  data,
}: {
  data: TherapistMetricsDashboard;
}) {
  const { overview, sessions, occupancy, interest } = data;
  const sparkline = overview.activity.points.map((point) => ({
    label: point.date,
    value: point.sessionsCompleted,
  }));
  const interestData = isInterestReady(interest) ? interest : null;
  const returnRate = interestData?.summary.returnRate ?? null;
  const topTherapy = overview.therapyRanking.items[0];

  return (
    <TherapistMetricsLayout meta={data.meta} tab="overview">
      <section aria-labelledby="metrics-overview-title">
        <div className="mb-5 max-w-3xl">
          <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-brand-primary">
            Visão geral
          </p>
          <h2
            className="mt-2 font-display text-[32px] font-light italic leading-tight text-brand-deep sm:text-[40px]"
            id="metrics-overview-title"
          >
            O movimento da sua prática
          </h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
            Dados reais de períodos completos para você acompanhar sessões,
            continuidade e disponibilidade com clareza.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <DashboardKpi
            copy={getTherapistMetricCopy(
              overview.counters.peopleServed.directionCopyKey,
            )}
            icon={UsersRound}
            label="Pessoas acompanhadas"
            sparkline={sparkline}
            value={formatMetricValue(
              overview.counters.peopleServed.value,
              "people",
            )}
          />
          <DashboardKpi
            copy={getTherapistMetricCopy(
              overview.counters.sessionsCompleted.directionCopyKey,
            )}
            icon={CalendarCheck2}
            label="Sessões realizadas"
            sparkline={sparkline}
            value={formatMetricValue(
              overview.counters.sessionsCompleted.value,
              "sessions",
            )}
          />
          <DashboardKpi
            copy="Tempo reservado em sessões concluídas"
            icon={Clock3}
            label="Tempo de atendimento"
            sparkline={sparkline}
            value={formatMetricValue(
              overview.counters.serviceMinutes.value,
              "minutes",
            )}
          />
          <DashboardKpi
            copy={
              returnRate?.status === "ready"
                ? "Pessoas que realizaram mais de uma sessão"
                : "Disponível no Premium Plus quando houver dados suficientes"
            }
            icon={RefreshCw}
            label="Pessoas que retornaram"
            sparkline={sparkline}
            value={
              returnRate?.status === "ready" && returnRate.value !== null
                ? `${formatNumber(returnRate.value)}%`
                : "—"
            }
          />
          <DashboardKpi
            copy={
              occupancy.status === "ready"
                ? "Minutos ocupados sobre a capacidade ofertada"
                : "O histórico começa a partir desta atualização"
            }
            icon={Eye}
            label="Ocupação da agenda"
            sparkline={
              occupancy.status === "ready"
                ? occupancy.series.map((point) => ({
                    label: point.date,
                    value: point.percentage ?? 0,
                  }))
                : []
            }
            value={
              occupancy.status === "ready" &&
              occupancy.current.percentage !== null
                ? `${formatNumber(occupancy.current.percentage)}%`
                : "Em formação"
            }
          />
          <DashboardKpi
            copy={
              topTherapy
                ? `${formatNumber(topTherapy.counter.value)} sessões no período`
                : "Aparece quando houver pelo menos dez sessões"
            }
            icon={Sparkles}
            label="Terapia mais realizada"
            sparkline={sparkline}
            value={topTherapy?.therapyName ?? "—"}
          />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <MetricPanel
          description={`Sessões concluídas nos últimos ${data.meta.periodDays} dias completos.`}
          icon={CalendarCheck2}
          title="Evolução das sessões"
        >
          {overview.activity.status === "ready" ? (
            <SessionsEvolutionChart points={overview.activity.points} />
          ) : (
            <EmptyMetric message="Ainda não há sessões concluídas neste período." />
          )}
        </MetricPanel>

        <MetricPanel
          description="Distribuição real das sessões por dia e faixa de horário."
          icon={Clock3}
          title="Horários com mais sessões"
        >
          {sessions.heatmap.status === "ready" ? (
            <MetricsHeatmap
              points={sessions.heatmap.items.map((point) => ({
                ...point,
                value: point.sessions,
              }))}
              valueLabel="sessões"
            />
          ) : (
            <ProtectedMetric status={sessions.heatmap.status} />
          )}
        </MetricPanel>

        <MetricPanel
          description="Caminho público até a reserva, exibido somente quando a coleta estiver autorizada."
          icon={Eye}
          title="Jornada até o agendamento"
        >
          {overview.discovery.status === "ready" ? (
            <JourneyFunnel
              stages={[
                {
                  label: "Viram o perfil",
                  value: overview.discovery.stages.profileViews.value,
                },
                {
                  label: "Iniciaram a reserva",
                  value: overview.discovery.stages.bookingFlowStarts.value,
                },
                {
                  label: "Sessões concluídas",
                  value: overview.counters.sessionsCompleted.value,
                },
              ]}
            />
          ) : (
            <UnavailableMetric
              title="Coleta pública desativada"
              message="Visualizações, interesse e funil permanecem ocultos até a revisão formal de privacidade e retenção."
            />
          )}
        </MetricPanel>

        <MetricPanel
          description="Terapias com mais sessões concluídas no período."
          icon={Star}
          title="Terapias mais realizadas"
        >
          {sessions.therapyDistribution.status === "ready" ? (
            <TherapyBarsChart
              items={sessions.therapyDistribution.items
                .slice(0, 6)
                .map((item) => ({
                  name: item.therapyName,
                  value: item.sessions,
                }))}
            />
          ) : (
            <ProtectedMetric status={sessions.therapyDistribution.status} />
          )}
        </MetricPanel>

        <MetricPanel
          description="Situação final registrada para as sessões do período."
          icon={CalendarCheck2}
          title="Resultados das sessões"
        >
          {sessions.outcomeDistribution.status === "ready" ? (
            <DistributionDonut
              centerLabel={`${sessions.outcomeDistribution.observedSample} sessões`}
              items={sessions.outcomeDistribution.items.map((item) => ({
                label: item.label,
                value: item.value,
              }))}
              label="Distribuição dos resultados das sessões"
            />
          ) : (
            <ProtectedMetric status={sessions.outcomeDistribution.status} />
          )}
        </MetricPanel>

        <MetricPanel
          description="Continuidade das pessoas acompanhadas, sem expor dados individuais."
          icon={UsersRound}
          title="Distribuição das pessoas"
        >
          {interestData && interestData.segments.status === "ready" ? (
            <DistributionDonut
              centerLabel={`${interestData.segments.observedSample} pessoas`}
              items={interestData.segments.items.map((item) => ({
                label: segmentLabel(item.key),
                value: item.value,
              }))}
              label="Situação das pessoas acompanhadas"
            />
          ) : interestData ? (
            <ProtectedMetric status={interestData.segments.status} />
          ) : (
            <UnavailableMetric
              title="Recurso do Premium Plus"
              message="A leitura de continuidade é liberada no Premium Plus quando houver dados de pelo menos dez pessoas."
            />
          )}
        </MetricPanel>

        <MetricPanel
          className="lg:col-span-2"
          description="Capacidade ofertada menos bloqueios e exceções, comparada às reservas elegíveis."
          icon={Clock3}
          title="Ocupação por dia e horário"
        >
          {occupancy.status === "ready" ? (
            <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-center">
              <div>
                <p className="text-[42px] font-extrabold text-brand-deep">
                  {formatNumber(occupancy.current.percentage ?? 0)}%
                </p>
                <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                  {formatMetricValue(
                    occupancy.current.occupiedMinutes,
                    "minutes",
                  )}{" "}
                  ocupados de{" "}
                  {formatMetricValue(
                    occupancy.current.offeredMinutes,
                    "minutes",
                  )}{" "}
                  ofertados.
                </p>
              </div>
              <MetricsHeatmap
                points={occupancy.heatmap.map((point) => ({
                  ...point,
                  value: point.percentage ?? 0,
                }))}
                valueLabel="de ocupação"
              />
            </div>
          ) : occupancy.status === "empty" ? (
            <EmptyMetric message="Não houve capacidade ofertada neste período." />
          ) : (
            <UnavailableMetric
              title="Histórico em formação"
              message={`Há ${occupancy.coverageDays} de ${occupancy.requiredCoverageDays} dias de cobertura confiável. A leitura será liberada automaticamente quando o período estiver completo.`}
            />
          )}
        </MetricPanel>
      </div>

      <AppPageSection className="grid gap-4 border-brand-lavender/80 bg-surface-soft/70 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
        <Info className="text-brand-primary" size={24} />
        <div>
          <h2 className="text-lg font-extrabold text-brand-deep">
            Como estes números são calculados
          </h2>
          <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-tesText-secondary">
            O dia atual fica de fora para evitar comparações incompletas. Alguns
            dados só aparecem quando há pelo menos dez registros, e a ocupação
            só é mostrada quando o histórico da agenda está completo.
          </p>
        </div>
      </AppPageSection>
    </TherapistMetricsLayout>
  );
}

function DashboardKpi({
  copy,
  icon: Icon,
  label,
  sparkline,
  value,
}: {
  copy: string;
  icon: typeof UsersRound;
  label: string;
  sparkline: Array<{ label: string; value: number }>;
  value: string;
}) {
  return (
    <TESCard
      as="article"
      className="flex min-h-[220px] min-w-0 flex-col p-4 sm:p-5"
    >
      <div className="flex min-h-11 items-start gap-2.5">
        <Icon
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-brand-primary"
          size={21}
        />
        <h3 className="text-sm font-extrabold leading-5 text-brand-deep">
          {label}
        </h3>
      </div>
      <p className="mt-5 break-words text-[28px] font-extrabold leading-tight text-brand-deep sm:text-[32px]">
        {value}
      </p>
      <p className="mt-2 min-h-10 text-xs font-semibold leading-5 text-tesText-secondary sm:text-sm">
        {copy}
      </p>
      <div className="mt-auto pt-3">
        {sparkline.length > 1 ? (
          <MetricSparkline data={sparkline} label={`Tendência de ${label}`} />
        ) : (
          <div className="h-12" />
        )}
      </div>
    </TESCard>
  );
}

function MetricPanel({
  children,
  className = "",
  description,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  description: string;
  icon: typeof UsersRound;
  title: string;
}) {
  return (
    <AppPageSection className={`min-w-0 ${className}`}>
      <div className="mb-5 flex items-start gap-3">
        <Icon
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-brand-primary"
          size={23}
        />
        <div>
          <h2 className="text-xl font-extrabold text-brand-deep sm:text-2xl">
            {title}
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            {description}
          </p>
        </div>
      </div>
      {children}
    </AppPageSection>
  );
}

function EmptyMetric({ message }: { message: string }) {
  return (
    <p className="rounded-card bg-surface-soft p-5 text-sm font-semibold leading-6 text-tesText-secondary">
      {message}
    </p>
  );
}
function ProtectedMetric({
  status,
}: {
  status: "empty" | "insufficient_sample" | "ready";
}) {
  return status === "empty" ? (
    <EmptyMetric message="Ainda não há dados neste período." />
  ) : (
    <UnavailableMetric
      title="Ainda não há dados suficientes"
      message="Este bloco será exibido quando houver pelo menos dez registros no período."
    />
  );
}
function UnavailableMetric({
  message,
  title,
}: {
  message: string;
  title: string;
}) {
  return (
    <div className="rounded-card border border-brand-lavender bg-surface-soft p-5">
      <h3 className="text-base font-extrabold text-brand-deep">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {message}
      </p>
    </div>
  );
}
function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(
    value,
  );
}
function segmentLabel(key: string) {
  return (
    (
      {
        active: "Ativas",
        inactive: "Inativas",
        new: "Novas",
        paused: "Pausadas",
        recurring: "Recorrentes",
      } as Record<string, string>
    )[key] ?? key
  );
}
function isInterestReady(
  value: TherapistInterestMetrics,
): value is TherapistInterestMetricsReady {
  return value.access.status === "ready";
}

export function TherapistMetricsErrorState({ message }: { message: string }) {
  return (
    <AppPageContainer className="max-w-[1280px]">
      <AppPageSection className="grid gap-5">
        <AlertCircle className="text-status-danger" size={28} />
        <div>
          <h1 className="font-display text-[34px] font-light italic leading-tight text-brand-deep sm:text-[46px]">
            Acompanhamento indisponível
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
            {message}
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 w-fit items-center justify-center rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover"
          href={routes.therapist.insights}
        >
          Tentar novamente
        </Link>
      </AppPageSection>
    </AppPageContainer>
  );
}
