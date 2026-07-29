import { BarChartHorizontal, Heart, LockKeyhole } from "lucide-react";

import { AppPageSection } from "@/components/app-page";

import { getTherapistMetricCopy } from "../therapist-metrics.copy";
import type { TherapistMetricsOverview } from "../therapist-metrics.types";

export function TherapistMetricsTherapyRanking({
  ranking,
}: {
  ranking: TherapistMetricsOverview["therapyRanking"];
}) {
  return (
    <AppPageSection aria-labelledby="therapy-ranking-title">
      <BarChartHorizontal
        aria-hidden="true"
        className="text-brand-primary"
        size={24}
      />
      <h2
        className="mt-4 text-lg font-extrabold text-brand-deep"
        id="therapy-ranking-title"
      >
        Terapias mais agendadas
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        Ordem baseada somente nas suas sessões concluídas.
      </p>

      {ranking.status === "ready" ? (
        <ol className="mt-5 grid gap-4">
          {ranking.items.map((item, index) => (
            <li
              className="border-t border-brand-lavender pt-4 first:border-0 first:pt-0"
              key={item.therapyId}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-extrabold text-brand-deep">
                    {index + 1}. {item.therapyName}
                  </p>
                  <p className="mt-1 text-xs font-bold text-brand-primary">
                    {item.counter.value} sessões concluídas
                  </p>
                </div>
                <span className="text-xs font-extrabold text-tesText-muted">
                  {item.counter.direction === "up"
                    ? "Subiu"
                    : item.counter.direction === "down"
                      ? "Caiu"
                      : "Estável"}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                {getTherapistMetricCopy(item.counter.directionCopyKey)}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-5 rounded-lg bg-surface-soft p-4">
          <p className="text-sm font-bold text-brand-deep">
            {ranking.status === "empty"
              ? "Ainda sem sessões concluídas neste período."
              : `Disponível após ${ranking.minimumSample} sessões concluídas no período.`}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            A amostra atual é de {ranking.observedSample}. Não exibimos uma
            ordem instável como se fosse uma tendência.
          </p>
        </div>
      )}
    </AppPageSection>
  );
}

export function TherapistMetricsFavorites({
  favorites,
}: {
  favorites: TherapistMetricsOverview["profileFavorites"];
}) {
  return (
    <AppPageSection aria-labelledby="profile-favorites-title">
      <div className="flex items-start justify-between gap-4">
        <Heart aria-hidden="true" className="text-brand-primary" size={24} />
        {favorites.status === "insufficient_sample" ? (
          <LockKeyhole
            aria-label="Métrica protegida por amostra mínima"
            className="text-tesText-muted"
            size={20}
          />
        ) : null}
      </div>
      <h2
        className="mt-4 text-lg font-extrabold text-brand-deep"
        id="profile-favorites-title"
      >
        Favoritos do perfil
      </h2>
      {favorites.status === "insufficient_sample" ? (
        <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
          Esta métrica aparece a partir de {favorites.minimumSample} novos
          favoritos no período. Favoritos pertencem ao perfil, nunca a uma
          terapia ou serviço.
        </p>
      ) : (
        <>
          <p className="mt-3 text-3xl font-extrabold text-brand-deep">
            {favorites.value}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            {getTherapistMetricCopy(favorites.directionCopyKey)}
          </p>
        </>
      )}
    </AppPageSection>
  );
}

export function TherapistMetricsOccupancyNotice() {
  return (
    <AppPageSection aria-labelledby="occupancy-title">
      <LockKeyhole aria-hidden="true" className="text-status-info" size={24} />
      <h2
        className="mt-4 text-lg font-extrabold text-brand-deep"
        id="occupancy-title"
      >
        Ocupação da agenda
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        Ainda não exibimos este percentual. A oferta histórica precisa ser
        versionada para que mudanças de horários e bloqueios não distorçam o
        resultado.
      </p>
    </AppPageSection>
  );
}
