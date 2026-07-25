import { CalendarClock, Heart, Sparkles, Video } from "lucide-react";

import { formatBookingMetricDate } from "@/features/bookings/booking-formatters";

import type { PatientEncounter } from "../patient-encounters.types";
import { PatientEncounterMetricCard } from "./patient-encounter-metric-card";

export function PatientEncountersMetrics({
  activeCount,
  completedCount,
  favoriteTherapistsCount,
  nextEncounter,
}: {
  activeCount: number;
  completedCount: number;
  favoriteTherapistsCount: number;
  nextEncounter: PatientEncounter | null;
}) {
  return (
    <section
      aria-label="Resumo dos seus encontros"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <PatientEncounterMetricCard
        icon={CalendarClock}
        label="Próximo encontro"
        supportingText={nextEncounter?.therapist.name ?? "Sem encontro agendado"}
        value={
          nextEncounter
            ? formatBookingMetricDate(nextEncounter.startsAt)
            : "Sem data"
        }
      />
      <PatientEncounterMetricCard
        icon={Sparkles}
        label="Sua jornada"
        supportingText="encontros realizados"
        value={String(completedCount)}
      />
      <PatientEncounterMetricCard
        icon={Video}
        label="Em andamento"
        supportingText="agendamentos ativos"
        value={String(activeCount)}
      />
      <PatientEncounterMetricCard
        icon={Heart}
        label="Favoritos"
        supportingText="terapeutas salvos"
        value={String(favoriteTherapistsCount)}
      />
    </section>
  );
}
