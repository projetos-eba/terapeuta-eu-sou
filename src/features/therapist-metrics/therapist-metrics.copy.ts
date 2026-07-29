import type { TherapistMetricDirectionCopyKey } from "./therapist-metrics.types";

const metricCopy: Record<TherapistMetricDirectionCopyKey, string> = {
  "therapist_metrics.booking_flow_starts.down":
    "Menos pessoas iniciaram o agendamento do que no período anterior.",
  "therapist_metrics.booking_flow_starts.stable":
    "Os inícios de agendamento ficaram estáveis em relação ao período anterior.",
  "therapist_metrics.booking_flow_starts.up":
    "Mais pessoas iniciaram o agendamento do que no período anterior.",
  "therapist_metrics.operational_presence.down":
    "A presença operacional ficou menor do que no período anterior.",
  "therapist_metrics.operational_presence.stable":
    "A presença operacional ficou próxima do período anterior.",
  "therapist_metrics.operational_presence.up":
    "A presença operacional ficou maior do que no período anterior.",
  "therapist_metrics.people_returned.down":
    "Menos pessoas voltaram para uma nova sessão neste período.",
  "therapist_metrics.people_returned.stable":
    "O número de pessoas que voltaram ficou próximo do período anterior.",
  "therapist_metrics.people_returned.up":
    "Mais pessoas voltaram para uma nova sessão neste período.",
  "therapist_metrics.people_served.down":
    "Você atendeu menos pessoas do que no período anterior.",
  "therapist_metrics.people_served.stable":
    "O número de pessoas atendidas ficou estável em relação ao período anterior.",
  "therapist_metrics.people_served.up":
    "Você atendeu mais pessoas do que no período anterior.",
  "therapist_metrics.profile_favorites.down":
    "Seu perfil recebeu menos novos favoritos do que no período anterior.",
  "therapist_metrics.profile_favorites.stable":
    "Os novos favoritos do perfil ficaram estáveis em relação ao período anterior.",
  "therapist_metrics.profile_favorites.up":
    "Seu perfil recebeu mais novos favoritos do que no período anterior.",
  "therapist_metrics.profile_to_booking.down":
    "A passagem do perfil para o início do agendamento diminuiu.",
  "therapist_metrics.profile_to_booking.stable":
    "A passagem do perfil para o início do agendamento ficou estável.",
  "therapist_metrics.profile_to_booking.up":
    "A passagem do perfil para o início do agendamento aumentou.",
  "therapist_metrics.profile_views.down":
    "Seu perfil foi aberto menos vezes do que no período anterior.",
  "therapist_metrics.profile_views.stable":
    "As aberturas do perfil ficaram estáveis em relação ao período anterior.",
  "therapist_metrics.profile_views.up":
    "Seu perfil foi aberto mais vezes do que no período anterior.",
  "therapist_metrics.reserved_duration_average.down":
    "A duração média reservada ficou menor do que no período anterior.",
  "therapist_metrics.reserved_duration_average.stable":
    "A duração média reservada ficou próxima do período anterior.",
  "therapist_metrics.reserved_duration_average.up":
    "A duração média reservada ficou maior do que no período anterior.",
  "therapist_metrics.return_rate.down":
    "A proporção de pessoas que voltaram diminuiu neste período.",
  "therapist_metrics.return_rate.stable":
    "A proporção de pessoas que voltaram ficou próxima do período anterior.",
  "therapist_metrics.return_rate.up":
    "A proporção de pessoas que voltaram aumentou neste período.",
  "therapist_metrics.search_impressions.down":
    "Seu perfil apareceu menos vezes na busca do que no período anterior.",
  "therapist_metrics.search_impressions.stable":
    "As aparições na busca ficaram estáveis em relação ao período anterior.",
  "therapist_metrics.search_impressions.up":
    "Seu perfil apareceu mais vezes na busca do que no período anterior.",
  "therapist_metrics.search_to_profile.down":
    "A passagem da busca para o perfil diminuiu.",
  "therapist_metrics.search_to_profile.stable":
    "A passagem da busca para o perfil ficou estável.",
  "therapist_metrics.search_to_profile.up":
    "A passagem da busca para o perfil aumentou.",
  "therapist_metrics.service_minutes.down":
    "O tempo dedicado aos atendimentos diminuiu em relação ao período anterior.",
  "therapist_metrics.service_minutes.stable":
    "O tempo dedicado aos atendimentos ficou estável em relação ao período anterior.",
  "therapist_metrics.service_minutes.up":
    "O tempo dedicado aos atendimentos aumentou em relação ao período anterior.",
  "therapist_metrics.sessions_cancelled.down":
    "Houve menos cancelamentos do que no período anterior.",
  "therapist_metrics.sessions_cancelled.stable":
    "O número de cancelamentos ficou próximo do período anterior.",
  "therapist_metrics.sessions_cancelled.up":
    "Houve mais cancelamentos do que no período anterior. Observe o contexto antes de ajustar sua rotina.",
  "therapist_metrics.sessions_completed.down":
    "Você realizou menos sessões do que no período anterior.",
  "therapist_metrics.sessions_completed.stable":
    "O número de sessões realizadas ficou estável em relação ao período anterior.",
  "therapist_metrics.sessions_completed.up":
    "Você realizou mais sessões do que no período anterior.",
  "therapist_metrics.sessions_per_person.down":
    "A frequência média por pessoa ficou menor do que no período anterior.",
  "therapist_metrics.sessions_per_person.stable":
    "A frequência média por pessoa ficou próxima do período anterior.",
  "therapist_metrics.sessions_per_person.up":
    "A frequência média por pessoa ficou maior do que no período anterior.",
  "therapist_metrics.sessions_rescheduled.down":
    "Houve menos reagendamentos do que no período anterior.",
  "therapist_metrics.sessions_rescheduled.stable":
    "O número de reagendamentos ficou próximo do período anterior.",
  "therapist_metrics.sessions_rescheduled.up":
    "Houve mais reagendamentos do que no período anterior. Vale observar os dias e horários envolvidos.",
  "therapist_metrics.therapy_bookings.down":
    "Essa terapia teve menos sessões concluídas do que no período anterior.",
  "therapist_metrics.therapy_bookings.stable":
    "As sessões concluídas dessa terapia ficaram estáveis.",
  "therapist_metrics.therapy_bookings.up":
    "Essa terapia teve mais sessões concluídas do que no período anterior.",
};

export function getTherapistMetricCopy(key: TherapistMetricDirectionCopyKey) {
  return metricCopy[key];
}
