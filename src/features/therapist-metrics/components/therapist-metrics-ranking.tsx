import { BarChartHorizontal, Heart, LockKeyhole } from "lucide-react";

import { AppPageSection } from "@/components/app-page";

import { getTherapistMetricCopy } from "../therapist-metrics.copy";
import type { TherapistMetricsOverview } from "../therapist-metrics.types";

export function TherapistMetricsTherapyRanking({
  ranking,
}: {
  ranking: TherapistMetricsOverview["therapyRanking"];
}) {
  const maximum = Math.max(
    1,
    ...ranking.items.map((item) => item.counter.value),
  );

  return (
    <AppPageSection aria-labelledby="therapy-ranking-title">
      <div className="flex items-start gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <BarChartHorizontal aria-hidden="true" size={21} />
        </span>
        <div>
          <h2
            className="text-lg font-extrabold text-brand-deep"
            id="therapy-ranking-title"
          >
            Terapias mais agendadas
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            Ordem baseada somente nas suas sessões concluídas.
          </p>
        </div>
      </div>

      {ranking.status === "ready" ? (
        <ol className="mt-5 grid gap-4">
          {ranking.items.map((item, index) => (
            <li className="grid gap-2" key={item.therapyId}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-extrabold text-brand-deep">
                    {index + 1}. {item.therapyName}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-extrabold text-brand-deep">
                  {item.counter.value}
                </span>
              </div>
              <span className="block h-2 overflow-hidden rounded-full bg-brand-lavenderSoft">
                <span
                  aria-hidden="true"
                  className="block h-full rounded-full bg-brand-primary"
                  style={{
                    width:
                      Math.max(8, (item.counter.value / maximum) * 100) + "%",
                  }}
                />
              </span>
              <p className="text-sm font-semibold leading-6 text-tesText-secondary">
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
