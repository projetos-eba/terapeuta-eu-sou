import type {
  TherapistInterestMetrics,
  TherapistInterestMetricsReady,
  TherapistMetricsOverview,
  TherapistMetricsTab,
  TherapistSessionMetrics,
} from "./therapist-metrics.types";

type ExportData =
  | TherapistInterestMetrics
  | TherapistMetricsOverview
  | TherapistSessionMetrics;

type CsvRow = {
  detail?: string | number | null;
  key: string;
  label: string;
  section: string;
  status: string;
  unit?: string | null;
  value?: string | number | null;
};

export function buildTherapistMetricsCsv({
  data,
  tab,
}: {
  data: ExportData;
  tab: TherapistMetricsTab;
}) {
  if (tab === "interest" && isInterestMetrics(data) && !isReadyInterest(data)) {
    throw new Error("CAPABILITY_NOT_ALLOWED");
  }

  const rows: CsvRow[] = [
    metadata("report_tab", "Visão exportada", tab),
    metadata("period_days", "Período em dias completos", data.meta.periodDays),
    metadata("period_start", "Início do período", data.meta.periodStart),
    metadata("period_end", "Fim exclusivo do período", data.meta.periodEnd),
    metadata("timezone", "Fuso horário", data.meta.timezone),
    metadata("fresh_through", "Dados atualizados até", data.meta.freshThrough),
    metadata(
      "metric_definition_version",
      "Versão das definições",
      data.metricDefinitionVersion,
    ),
    metadata("contract_version", "Versão do contrato", data.contractVersion),
  ];

  if (tab === "overview" && "counters" in data) {
    appendCounter(
      rows,
      "overview",
      "people_served",
      "Pessoas atendidas",
      data.counters.peopleServed,
    );
    appendCounter(
      rows,
      "overview",
      "sessions_completed",
      "Sessões concluídas",
      data.counters.sessionsCompleted,
    );
    appendCounter(
      rows,
      "overview",
      "service_minutes",
      "Tempo de atendimento",
      data.counters.serviceMinutes,
    );
    data.activity.points.forEach((point) => {
      rows.push({
        key: point.date,
        label: "Sessões concluídas no dia",
        section: "activity",
        status: data.activity.status,
        unit: "sessions",
        value: point.sessionsCompleted,
      });
    });
    rows.push({
      detail: data.discovery.reason,
      key: "discovery",
      label: "Como as pessoas encontram seu perfil",
      section: "discovery",
      status: data.discovery.status,
    });
    appendSampled(
      rows,
      "overview",
      "profile_favorites",
      "Novos favoritos",
      data.profileFavorites,
    );
    appendProtectedItems(
      rows,
      "therapy_ranking",
      data.therapyRanking,
      (item) => ({
        detail: item.counter.directionCopyKey,
        key: item.therapyId,
        label: item.therapyName,
        unit: item.counter.unit,
        value: item.counter.value,
      }),
    );
    rows.push({
      detail: data.occupancy.reason,
      key: "occupancy",
      label: "Ocupação da agenda",
      section: "occupancy",
      status: data.occupancy.status,
    });
  }

  if (tab === "sessions" && "summary" in data && "heatmap" in data) {
    appendCounter(
      rows,
      "sessions",
      "sessions_completed",
      "Sessões concluídas",
      data.summary.sessionsCompleted,
    );
    appendSampled(
      rows,
      "sessions",
      "operational_presence",
      "Comparecimento às sessões",
      data.summary.operationalPresence,
    );
    appendCounter(
      rows,
      "sessions",
      "sessions_cancelled",
      "Cancelamentos",
      data.summary.sessionsCancelled,
    );
    appendCounter(
      rows,
      "sessions",
      "sessions_rescheduled",
      "Reagendamentos",
      data.summary.sessionsRescheduled,
    );
    appendCounter(
      rows,
      "sessions",
      "reserved_duration_average",
      "Duração média das sessões",
      data.summary.reservedDurationAverage,
    );

    appendProtectedItems(
      rows,
      "outcome_distribution",
      data.outcomeDistribution,
      (item) => ({
        detail: item.value,
        key: item.key,
        label: item.label,
        unit: "percent",
        value: item.percentage,
      }),
    );
    data.evolution.points.forEach((point) => {
      rows.push(
        {
          key: `${point.date}:completed`,
          label: "Sessões concluídas",
          section: "session_evolution",
          status: data.evolution.status,
          unit: "sessions",
          value: point.sessionsCompleted,
        },
        {
          key: `${point.date}:cancelled`,
          label: "Sessões canceladas",
          section: "session_evolution",
          status: data.evolution.status,
          unit: "sessions",
          value: point.sessionsCancelled,
        },
        {
          key: `${point.date}:no_show`,
          label: "Ausências",
          section: "session_evolution",
          status: data.evolution.status,
          unit: "sessions",
          value: point.noShows,
        },
        {
          key: `${point.date}:rescheduled`,
          label: "Reagendamentos",
          section: "session_evolution",
          status: data.evolution.status,
          unit: "sessions",
          value: point.sessionsRescheduled,
        },
      );
    });
    appendOwnHistoryItems(rows, "heatmap", data.heatmap, (item) => ({
      detail: `day=${item.dayOfWeek};hour_start=${item.hourBucketStart}`,
      key: `${item.dayOfWeek}:${item.hourBucketStart}`,
      label: "Sessões concluídas por dia e faixa de horário",
      unit: "sessions",
      value: item.sessions,
    }));
    appendProtectedItems(
      rows,
      "therapy_distribution",
      data.therapyDistribution,
      (item) => ({
        detail: `share=${item.percentage}%`,
        key: item.therapyId,
        label: item.therapyName,
        unit: "sessions",
        value: item.sessions,
      }),
    );
    rows.push({
      detail: data.cancellationReasons.reason,
      key: "cancellation_reasons",
      label: "Motivos de cancelamento",
      section: "cancellation_reasons",
      status: data.cancellationReasons.status,
    });
  }

  if (tab === "interest" && isReadyInterest(data)) {
    appendReturnSummary(
      rows,
      "interest",
      data.summary.peopleReturned,
      data.summary.returnRate,
    );
    appendSampled(
      rows,
      "interest",
      "sessions_per_person",
      "Frequência de sessões por pessoa",
      data.summary.sessionsPerPerson,
    );
    appendFavoriteActivity(
      rows,
      "interest",
      "profile_favorites",
      "Novos favoritos",
      data.summary.profileFavorites,
    );
    appendProtectedItems(rows, "segments", data.segments, (item) => ({
      detail: `share=${item.percentage}%`,
      key: item.key,
      label: exportSegmentLabel(item.key),
      unit: "people",
      value: item.value,
    }));
    appendProtectedItems(
      rows,
      "base_evolution",
      data.baseEvolution,
      (item) => ({
        detail: `new_people=${item.newPeople}`,
        key: item.date,
        label: "Pessoas atendidas",
        unit: "people",
        value: item.totalPeople,
      }),
    );
    appendProtectedItems(rows, "cohorts", data.cohorts, (item) => ({
      detail: JSON.stringify(item.retention),
      key: item.cohortMonth,
      label: "Grupo mensal",
      unit: "people",
      value: item.cohortSize,
    }));
    appendProtectedItems(
      rows,
      "therapy_return",
      data.therapyReturn,
      (item) => ({
        detail: `returned=${item.returnedPeople};eligible=${item.people}`,
        key: item.therapyId,
        label: item.therapyName,
        unit: "percent",
        value: item.returnRate,
      }),
    );
    [
      [
        "favorite_conversion",
        "Favoritos que levaram a uma sessão",
        data.favoriteConversion,
      ],
      ["sentiment", "Sentimento depois da sessão", data.sentiment],
      [
        "availability_gap",
        "Procura sem horário disponível",
        data.availabilityGap,
      ],
      [
        "journey_themes",
        "Temas mais recorrentes na jornada",
        data.journeyThemes,
      ],
      ["exit_reasons", "Motivos de saída", data.exitReasons],
    ].forEach(([key, label, block]) => {
      const unavailable = block as { reason: string; status: "unavailable" };
      rows.push({
        detail: unavailable.reason,
        key: String(key),
        label: String(label),
        section: "unavailable_signals",
        status: unavailable.status,
      });
    });
  }

  return serializeCsv(rows);
}

function appendReturnSummary(
  rows: CsvRow[],
  section: string,
  peopleReturned: TherapistInterestMetricsReady["summary"]["peopleReturned"],
  returnRate: TherapistInterestMetricsReady["summary"]["returnRate"],
) {
  const ready =
    peopleReturned.status === "ready" && returnRate.status === "ready";

  rows.push({
    detail: `minimum_sample=${returnRate.minimumSample};observed_sample=${returnRate.observedSample};returned_people=${ready ? peopleReturned.value : ""};copy_key=${returnRate.directionCopyKey ?? ""}`,
    key: "return_summary",
    label: "Pessoas que retornaram",
    section,
    status: ready ? "ready" : "insufficient_sample",
    unit: "percent",
    value: ready ? returnRate.value : null,
  });
}

function appendFavoriteActivity(
  rows: CsvRow[],
  section: string,
  key: string,
  label: string,
  favorites: TherapistInterestMetricsReady["summary"]["profileFavorites"],
) {
  rows.push({
    detail: `comparison_status=${favorites.comparison.status};minimum_sample=${favorites.comparison.minimumSample};observed_sample=${favorites.comparison.observedSample};copy_key=${favorites.comparison.directionCopyKey ?? ""}`,
    key,
    label,
    section,
    status: favorites.activity.status,
    unit: favorites.activity.unit,
    value: favorites.activity.value,
  });
}

function appendCounter(
  rows: CsvRow[],
  section: string,
  key: string,
  label: string,
  metric: {
    directionCopyKey: string;
    previousValue: number;
    status: string;
    unit: string;
    value: number;
  },
) {
  rows.push({
    detail: `previous=${metric.previousValue};copy_key=${metric.directionCopyKey}`,
    key,
    label,
    section,
    status: metric.status,
    unit: metric.unit,
    value: metric.value,
  });
}

function appendSampled(
  rows: CsvRow[],
  section: string,
  key: string,
  label: string,
  metric: {
    directionCopyKey: string | null;
    minimumSample: number;
    observedSample: number;
    status: string;
    unit: string;
    value: number | null;
  },
) {
  rows.push({
    detail: `minimum_sample=${metric.minimumSample};observed_sample=${metric.observedSample};copy_key=${metric.directionCopyKey ?? ""}`,
    key,
    label,
    section,
    status: metric.status,
    unit: metric.unit,
    value: metric.value,
  });
}

function appendProtectedItems<T>(
  rows: CsvRow[],
  section: string,
  collection: {
    items: T[];
    minimumSample: number;
    observedSample: number;
    status: string;
  },
  mapItem: (item: T) => Omit<CsvRow, "section" | "status">,
) {
  if (collection.status !== "ready") {
    rows.push({
      detail: `minimum_sample=${collection.minimumSample};observed_sample=${collection.observedSample}`,
      key: section,
      label: humanExportLabel(section),
      section,
      status: collection.status,
    });
    return;
  }

  collection.items.forEach((item) => {
    rows.push({
      ...mapItem(item),
      section,
      status: collection.status,
    });
  });
}

function appendOwnHistoryItems<T>(
  rows: CsvRow[],
  section: string,
  collection: {
    items: T[];
    observedSample: number;
    status: string;
  },
  mapItem: (item: T) => Omit<CsvRow, "section" | "status">,
) {
  if (collection.status !== "ready") {
    rows.push({
      detail: `observed_sample=${collection.observedSample}`,
      key: section,
      label: humanExportLabel(section),
      section,
      status: collection.status,
    });
    return;
  }

  collection.items.forEach((item) => {
    rows.push({
      ...mapItem(item),
      section,
      status: collection.status,
    });
  });
}

function metadata(key: string, label: string, value: string | number): CsvRow {
  return {
    key,
    label,
    section: "metadata",
    status: "ready",
    value,
  };
}

function humanExportLabel(section: string) {
  const labels: Record<string, string> = {
    base_evolution: "Pessoas atendidas",
    cancellation_reasons: "Motivos de cancelamento",
    cohorts: "Grupos mensais",
    heatmap: "Sessões concluídas por dia e faixa de horário",
    journey_themes: "Temas mais recorrentes na jornada",
    outcome_distribution: "Como as sessões terminaram",
    segments: "Como está a continuidade",
    therapy_distribution: "Sessões concluídas por terapia",
    therapy_ranking: "Terapias mais realizadas",
    therapy_return: "Pessoas que retornaram por terapia",
  };

  return labels[section] ?? section;
}

function exportSegmentLabel(key: string) {
  const labels: Record<string, string> = {
    active: "Pessoas em acompanhamento",
    inactive: "Pessoas sem retorno recente",
    new: "Pessoas novas",
    paused: "Pessoas em pausa",
    recurring: "Pessoas que retornaram",
  };

  return labels[key] ?? key;
}

function serializeCsv(rows: CsvRow[]) {
  const headers = [
    "section",
    "key",
    "label",
    "status",
    "value",
    "unit",
    "detail",
  ];
  const lines = rows.map((row) =>
    [
      row.section,
      row.key,
      row.label,
      row.status,
      row.value ?? "",
      row.unit ?? "",
      row.detail ?? "",
    ]
      .map(csvCell)
      .join(","),
  );
  return `\uFEFF${headers.join(",")}\r\n${lines.join("\r\n")}\r\n`;
}

function csvCell(value: string | number) {
  const text = String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function isInterestMetrics(data: ExportData): data is TherapistInterestMetrics {
  return "access" in data;
}

function isReadyInterest(
  data: ExportData,
): data is TherapistInterestMetricsReady {
  return isInterestMetrics(data) && data.access.status === "ready";
}
