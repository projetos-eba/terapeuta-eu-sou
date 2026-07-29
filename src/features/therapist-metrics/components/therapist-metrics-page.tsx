import Link from "next/link";
import {
  AlertCircle,
  CalendarCheck2,
  Clock3,
  Info,
  UsersRound,
} from "lucide-react";

import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageMain,
  AppPageSection,
} from "@/components/app-page";
import { routes } from "@/lib/routes";

import { getTherapistMetricCopy } from "../therapist-metrics.copy";
import type { TherapistMetricsOverview } from "../therapist-metrics.types";
import { TherapistMetricCard } from "./therapist-metric-card";
import { TherapistMetricsActivity } from "./therapist-metrics-activity";
import { TherapistMetricsDiscovery } from "./therapist-metrics-discovery";
import {
  TherapistMetricsFavorites,
  TherapistMetricsOccupancyNotice,
  TherapistMetricsTherapyRanking,
} from "./therapist-metrics-ranking";
import { TherapistMetricsLayout } from "./therapist-metrics-layout";

export function TherapistMetricsPage({
  data,
}: {
  data: TherapistMetricsOverview;
}) {
  return (
    <TherapistMetricsLayout meta={data.meta} tab="overview">
      <section aria-labelledby="metrics-overview-title">
        <div className="mb-4">
          <h2
            className="font-display text-[30px] font-light italic leading-tight text-brand-deep sm:text-[36px]"
            id="metrics-overview-title"
          >
            Visão geral
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            Comparações feitas apenas com o seu próprio histórico.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <TherapistMetricCard
            copy={getTherapistMetricCopy(
              data.counters.peopleServed.directionCopyKey,
            )}
            counter={data.counters.peopleServed}
            icon={UsersRound}
            label="Pessoas atendidas"
          />
          <TherapistMetricCard
            copy={getTherapistMetricCopy(
              data.counters.sessionsCompleted.directionCopyKey,
            )}
            counter={data.counters.sessionsCompleted}
            icon={CalendarCheck2}
            label="Sessões realizadas"
          />
          <TherapistMetricCard
            copy={getTherapistMetricCopy(
              data.counters.serviceMinutes.directionCopyKey,
            )}
            counter={data.counters.serviceMinutes}
            icon={Clock3}
            label="Tempo de atendimento"
          />
        </div>
      </section>

      <AppPageGrid>
        <AppPageMain>
          <TherapistMetricsActivity
            periodDays={data.meta.periodDays}
            points={data.activity.points}
            status={data.activity.status}
            timezone={data.meta.timezone}
          />
          <TherapistMetricsDiscovery discovery={data.discovery} />
        </AppPageMain>

        <AppPageAside>
          <TherapistMetricsTherapyRanking ranking={data.therapyRanking} />
          <TherapistMetricsFavorites favorites={data.profileFavorites} />
          <TherapistMetricsOccupancyNotice />
          <AppPageSection>
            <Info aria-hidden="true" className="text-brand-primary" size={21} />
            <h2 className="mt-4 text-base font-extrabold text-brand-deep">
              Como estes números são calculados
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              Consideramos somente sessões concluídas. Pessoas não são
              duplicadas dentro do período, e o tempo usa a duração registrada
              na reserva. O dia atual fica de fora para evitar comparações
              incompletas.
            </p>
          </AppPageSection>
        </AppPageAside>
      </AppPageGrid>
    </TherapistMetricsLayout>
  );
}

export function TherapistMetricsErrorState({ message }: { message: string }) {
  return (
    <AppPageContainer>
      <AppPageSection className="grid gap-5">
        <span className="grid size-12 place-items-center rounded-full bg-status-dangerBg text-status-danger">
          <AlertCircle aria-hidden="true" size={24} />
        </span>
        <div>
          <h1 className="font-display text-[34px] font-light italic leading-tight text-brand-deep sm:text-[46px]">
            Métricas indisponíveis
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
            {message}
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 w-fit items-center justify-center rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={routes.therapist.insights}
        >
          Tentar novamente
        </Link>
      </AppPageSection>
    </AppPageContainer>
  );
}
