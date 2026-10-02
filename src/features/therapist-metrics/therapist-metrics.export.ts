import type {
  TherapistInterestMetrics,
  TherapistInterestMetricsReady,
  TherapistMetricCounter,
  TherapistMetricSampledValue,
  TherapistMetricsOverview,
  TherapistMetricsTab,
  TherapistSessionMetrics,
} from "./therapist-metrics.types";

type ExportData =
  | TherapistInterestMetrics
  | TherapistMetricsOverview
  | TherapistSessionMetrics;

type CsvCell = number | string | null | undefined;
type CsvRows = CsvCell[][];

const timezoneLabels: Record<string, string> = {
  "America/Sao_Paulo": "América/São Paulo",
};

const weekdayLabels = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export function buildTherapistMetricsCsv({
  data,
  generatedAt = new Date(),
  tab,
}: {
  data: ExportData;
  generatedAt?: Date;
  tab: TherapistMetricsTab;
}) {
  if (tab === "interest" && isInterestMetrics(data) && !isReadyInterest(data)) {
    throw new Error("CAPABILITY_NOT_ALLOWED");
  }

  const rows = reportHeader(data, tab, generatedAt);

  if (tab === "overview" && "counters" in data) appendOverview(rows, data);
  if (tab === "sessions" && "summary" in data && "heatmap" in data) {
    appendSessions(rows, data);
  }
  if (tab === "interest" && isReadyInterest(data)) appendInterest(rows, data);

  return serializeCsv(rows);
}

function reportHeader(
  data: ExportData,
  tab: TherapistMetricsTab,
  generatedAt: Date,
): CsvRows {
  const timezone = data.meta.timezone;

  return [
    ["Relatório de métricas"],
    ["Acompanhamento do período selecionado"],
    [],
    ["Informações do relatório"],
    ["Período", formatPeriod(data.meta.periodStart, data.meta.periodEnd, timezone)],
    ["Data de geração", formatDateTime(generatedAt, timezone)],
    ["Fuso horário", timezoneLabels[timezone] ?? timezone],
    ["Dados atualizados até", formatDateTime(data.meta.freshThrough, timezone)],
    ["Visão", tabLabel(tab)],
    [],
  ];
}

function appendOverview(rows: CsvRows, data: TherapistMetricsOverview) {
  appendSection(rows, "Resumo das métricas");
  rows.push(["Métrica", "Valor", "Situação"]);
  appendCounterRow(rows, "Pessoas atendidas", data.counters.peopleServed);
  appendCounterRow(rows, "Sessões realizadas", data.counters.sessionsCompleted);
  appendCounterRow(rows, "Minutos de atendimento", data.counters.serviceMinutes);
  appendSampledRow(rows, "Novos favoritos", data.profileFavorites);

  appendSection(rows, "Atividade diária");
  rows.push([
    "Data",
    "Sessões realizadas",
    "Minutos de atendimento",
    "Pessoas atendidas",
    "Status do dia",
  ]);
  data.activity.points.forEach((point) => {
    rows.push([
      formatLocalDate(point.date),
      point.sessionsCompleted,
      "Sem dados suficientes",
      "Sem dados suficientes",
      point.sessionsCompleted > 0 ? "Com sessões realizadas" : "Sem sessões",
    ]);
  });
  appendEmptyActivityRow(rows, data.activity.points.length);

  appendSection(rows, "Indicadores complementares");
  rows.push(["Indicador", "Valor", "Status / observação"]);
  appendDiscoveryRows(rows, data);
  appendUnavailableRow(rows, "Taxa de ocupação da agenda", data.occupancy.status);

  appendSection(rows, "Terapias mais realizadas");
  rows.push(["Posição", "Terapia", "Sessões realizadas", "Situação"]);
  if (data.therapyRanking.status === "ready") {
    data.therapyRanking.items.forEach((item, index) => {
      rows.push([
        index + 1,
        item.therapyName,
        item.counter.value,
        statusLabel(item.counter.status),
      ]);
    });
  } else {
    rows.push([
      "",
      "Sem dados suficientes",
      "",
      statusObservation(data.therapyRanking.status),
    ]);
  }
}

function appendDiscoveryRows(rows: CsvRows, data: TherapistMetricsOverview) {
  if (data.discovery.status === "unavailable") {
    appendUnavailableRow(rows, "Visualizações do perfil", data.discovery.status);
    appendUnavailableRow(rows, "Inícios de agendamento", data.discovery.status);
    appendUnavailableRow(rows, "Pessoas que encontraram seu perfil", data.discovery.status);
    appendUnavailableRow(rows, "Perfil para agendamento", "insufficient_sample");
    appendUnavailableRow(rows, "Busca para perfil", "insufficient_sample");
    return;
  }

  appendCounterRow(rows, "Visualizações do perfil", data.discovery.stages.profileViews);
  appendCounterRow(rows, "Inícios de agendamento", data.discovery.stages.bookingFlowStarts);
  appendCounterRow(
    rows,
    "Pessoas que encontraram seu perfil",
    data.discovery.stages.searchImpressions,
  );
  appendSampledRow(rows, "Perfil para agendamento", data.discovery.funnel.profileToBooking);
  appendSampledRow(rows, "Busca para perfil", data.discovery.funnel.searchToProfile);
}

function appendSessions(rows: CsvRows, data: TherapistSessionMetrics) {
  appendSection(rows, "Resumo das métricas");
  rows.push(["Métrica", "Valor", "Situação"]);
  appendCounterRow(rows, "Sessões realizadas", data.summary.sessionsCompleted);
  appendSampledRow(rows, "Comparecimento às sessões", data.summary.operationalPresence);
  appendCounterRow(rows, "Cancelamentos", data.summary.sessionsCancelled);
  appendCounterRow(rows, "Reagendamentos", data.summary.sessionsRescheduled);
  appendCounterRow(
    rows,
    "Duração média das sessões (minutos)",
    data.summary.reservedDurationAverage,
  );

  appendSection(rows, "Atividade diária");
  rows.push([
    "Data",
    "Sessões realizadas",
    "Cancelamentos",
    "Sessões não realizadas",
    "Reagendamentos",
  ]);
  data.evolution.points.forEach((point) => {
    rows.push([
      formatLocalDate(point.date),
      point.sessionsCompleted,
      point.sessionsCancelled,
      point.noShows,
      point.sessionsRescheduled,
    ]);
  });
  appendEmptyActivityRow(rows, data.evolution.points.length);

  appendSection(rows, "Como as sessões terminaram");
  rows.push(["Situação", "Sessões", "Percentual (%)", "Situação do indicador"]);
  appendProtectedRows(rows, data.outcomeDistribution, (item) => [
    item.label,
    item.value,
    item.percentage,
    "Disponível",
  ]);

  appendSection(rows, "Frequência da agenda");
  rows.push(["Dia da semana", "Faixa de horário", "Sessões realizadas", "Situação"]);
  appendOwnHistoryRows(rows, data.heatmap, (item) => [
    weekdayLabels[item.dayOfWeek] ?? "Dia não informado",
    formatHourBucket(item.hourBucketStart),
    item.sessions,
    "Disponível",
  ]);

  appendSection(rows, "Sessões por terapia");
  rows.push(["Terapia", "Sessões realizadas", "Percentual (%)", "Situação"]);
  appendProtectedRows(rows, data.therapyDistribution, (item) => [
    item.therapyName,
    item.sessions,
    item.percentage,
    "Disponível",
  ]);

  appendSection(rows, "Indicadores complementares");
  rows.push(["Indicador", "Valor", "Status / observação"]);
  appendUnavailableRow(rows, "Motivos de cancelamento", data.cancellationReasons.status);
}

function appendInterest(rows: CsvRows, data: TherapistInterestMetricsReady) {
  appendSection(rows, "Resumo das métricas");
  rows.push(["Métrica", "Valor", "Situação"]);
  appendSampledRow(rows, "Pessoas que retornaram", data.summary.peopleReturned);
  appendSampledRow(rows, "Taxa de retorno (%)", data.summary.returnRate);
  appendSampledRow(rows, "Média de sessões por pessoa", data.summary.sessionsPerPerson);
  rows.push([
    "Novos favoritos",
    data.summary.profileFavorites.activity.value,
    statusLabel(data.summary.profileFavorites.activity.status),
  ]);

  appendSection(rows, "Atividade por período");
  rows.push(["Data", "Pessoas atendidas", "Novas pessoas", "Situação"]);
  appendProtectedRows(rows, data.baseEvolution, (item) => [
    formatLocalDate(item.date),
    item.totalPeople,
    item.newPeople,
    "Disponível",
  ]);

  appendSection(rows, "Continuidade do acompanhamento");
  rows.push(["Indicador", "Pessoas", "Percentual (%)", "Situação"]);
  appendProtectedRows(rows, data.segments, (item) => [
    exportSegmentLabel(item.key),
    item.value,
    item.percentage,
    "Disponível",
  ]);

  appendSection(rows, "Retorno por terapia");
  rows.push([
    "Terapia",
    "Pessoas atendidas",
    "Pessoas que retornaram",
    "Taxa de retorno (%)",
  ]);
  appendProtectedRows(rows, data.therapyReturn, (item) => [
    item.therapyName,
    item.people,
    item.returnedPeople,
    item.returnRate,
  ]);

  appendCohortRows(rows, data);

  appendSection(rows, "Outros indicadores");
  rows.push(["Indicador", "Valor", "Status / observação"]);
  appendUnavailableRow(rows, "Favoritos que levaram a uma sessão", data.favoriteConversion.status);
  appendUnavailableRow(rows, "Percepção após as sessões", data.sentiment.status);
  appendUnavailableRow(rows, "Procura sem horário disponível", data.availabilityGap.status);
  appendUnavailableRow(rows, "Temas mais recorrentes", data.journeyThemes.status);
  appendUnavailableRow(rows, "Motivos de encerramento", data.exitReasons.status);
}

function appendCohortRows(rows: CsvRows, data: TherapistInterestMetricsReady) {
  appendSection(rows, "Acompanhamento por período de início");

  if (data.cohorts.status !== "ready") {
    rows.push(["Mês de início", "Pessoas", "Situação"]);
    rows.push(["", "Sem dados suficientes", statusObservation(data.cohorts.status)]);
    return;
  }

  const monthOffsets = Array.from(
    new Set(
      data.cohorts.items.flatMap((item) =>
        item.retention.map((retention) => retention.monthOffset),
      ),
    ),
  ).sort((left, right) => left - right);

  rows.push([
    "Mês de início",
    "Pessoas",
    ...monthOffsets.map((offset) => `Retorno após ${offset} mês${offset === 1 ? "" : "es"} (%)`),
  ]);
  data.cohorts.items.forEach((item) => {
    const retentionByOffset = new Map(
      item.retention.map((retention) => [retention.monthOffset, retention.percentage]),
    );
    rows.push([
      formatLocalMonth(item.cohortMonth),
      item.cohortSize,
      ...monthOffsets.map((offset) => retentionByOffset.get(offset) ?? "Sem dados suficientes"),
    ]);
  });
}

function appendCounterRow(
  rows: CsvRows,
  label: string,
  metric: TherapistMetricCounter<"events" | "minutes" | "people" | "sessions">,
) {
  rows.push([label, metric.value, statusLabel(metric.status)]);
}

function appendSampledRow(
  rows: CsvRows,
  label: string,
  metric: TherapistMetricSampledValue<"favorites" | "people" | "percent" | "ratio">,
) {
  rows.push([
    label,
    metric.status === "ready" ? metric.value : "Sem dados suficientes",
    statusLabel(metric.status),
  ]);
}

function appendUnavailableRow(
  rows: CsvRows,
  label: string,
  status: "empty" | "forming" | "insufficient_sample" | "unavailable",
) {
  rows.push([label, unavailableValue(status), statusObservation(status)]);
}

function appendProtectedRows<T>(
  rows: CsvRows,
  collection: { items: T[]; status: "empty" | "insufficient_sample" | "ready" },
  mapItem: (item: T) => CsvCell[],
) {
  if (collection.status !== "ready") {
    rows.push(["Sem dados suficientes", "", statusObservation(collection.status)]);
    return;
  }

  collection.items.forEach((item) => rows.push(mapItem(item)));
}

function appendOwnHistoryRows<T>(
  rows: CsvRows,
  collection: { items: T[]; status: "empty" | "ready" },
  mapItem: (item: T) => CsvCell[],
) {
  if (collection.status !== "ready") {
    rows.push(["Sem registros no período", "", "", statusObservation(collection.status)]);
    return;
  }

  collection.items.forEach((item) => rows.push(mapItem(item)));
}

function appendEmptyActivityRow(rows: CsvRows, length: number) {
  if (length === 0) rows.push(["Sem registros no período", "", "", "", "Sem sessões"]);
}

function appendSection(rows: CsvRows, title: string) {
  rows.push([], [title]);
}

function statusLabel(status: string) {
  if (status === "ready") return "Disponível";
  if (status === "empty") return "Sem registros no período";
  return "Sem dados suficientes";
}

function unavailableValue(status: string) {
  return status === "empty" ? "Sem registros no período" : "Sem dados suficientes";
}

function statusObservation(status: string) {
  if (status === "empty") return "Não houve registros neste período.";
  if (status === "forming") return "Este indicador ainda está sendo formado.";
  return "Ainda não há dados suficientes para apresentar este indicador.";
}

function tabLabel(tab: TherapistMetricsTab) {
  const labels: Record<TherapistMetricsTab, string> = {
    interest: "Interesse",
    overview: "Visão geral",
    sessions: "Sessões",
  };

  return labels[tab];
}

function exportSegmentLabel(key: string) {
  const labels: Record<string, string> = {
    active: "Pessoas em acompanhamento",
    inactive: "Pessoas sem retorno recente",
    new: "Pessoas novas",
    paused: "Pessoas em pausa",
    recurring: "Pessoas que retornaram",
  };

  return labels[key] ?? "Outro grupo";
}

function formatPeriod(periodStart: string, periodEnd: string, timezone: string) {
  const inclusiveEnd = new Date(new Date(periodEnd).getTime() - 1);
  return `${formatDate(periodStart, timezone)} a ${formatDate(inclusiveEnd, timezone)}`;
}

function formatDate(value: Date | string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: Date | string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).format(new Date(value));
}

function formatLocalDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatLocalMonth(value: string) {
  const [year, month] = value.split("-");
  return year && month ? `${month}/${year}` : value;
}

function formatHourBucket(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function serializeCsv(rows: CsvRows) {
  const lines = rows.map((row) => row.map(csvCell).join(";"));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function csvCell(value: CsvCell) {
  const text = value == null ? "" : String(value);
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  if (!/[;"\r\n]/.test(safeText)) return safeText;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function isInterestMetrics(data: ExportData): data is TherapistInterestMetrics {
  return "access" in data;
}

function isReadyInterest(
  data: ExportData,
): data is TherapistInterestMetricsReady {
  return isInterestMetrics(data) && data.access.status === "ready";
}
