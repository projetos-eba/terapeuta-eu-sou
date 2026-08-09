import type {
  AdminOperationField,
  AdminOperationModuleKey,
  AdminOperationRow,
} from "./admin-operations.types";

type UnknownRecord = Record<string, unknown>;

export function mapAdminOperationRows({
  module,
  rows,
}: {
  module: AdminOperationModuleKey;
  rows: unknown[];
}): AdminOperationRow[] {
  return rows.filter(isRecord).map((row, index) => {
    if (module === "professionals") return mapProfessionalRow(row, index);
    if (module === "verifications") return mapVerificationRow(row, index);
    if (module === "patients") return mapPatientRow(row, index);
    if (module === "sessions") return mapSessionRow(row, index);
    if (module === "support") return mapSupportRow(row, index);
    return mapReviewRow(row, index);
  });
}

function mapProfessionalRow(row: UnknownRecord, index: number) {
  return {
    fields: compactFields([
      field("Plano", asText(row.plan)),
      field("Perfil público", asText(row.public_status)),
      field("Publicado", asBooleanLabel(row.is_public)),
      field("Reservas", asBooleanLabel(row.is_accepting_bookings)),
      field("Atualizado", formatDate(row.updated_at)),
    ]),
    id: asText(row.id) || `professional-${index}`,
    statusLabel: asText(row.status),
    subtitle: asText(row.slug),
    title: asText(row.public_name) || "Profissional sem nome público",
  } satisfies AdminOperationRow;
}

function mapVerificationRow(row: UnknownRecord, index: number) {
  return {
    fields: compactFields([
      field("Perfil", asText(row.therapist_profile_id)),
      field("Enviado", formatDate(row.submitted_at)),
      field("Revisado", formatDate(row.reviewed_at)),
      field("Atualizado", formatDate(row.updated_at)),
    ]),
    id: asText(row.id) || `verification-${index}`,
    statusLabel: asText(row.status),
    subtitle: "Documentos privados não são exibidos nesta lista.",
    title: `Verificação ${shortId(asText(row.id))}`,
  } satisfies AdminOperationRow;
}

function mapPatientRow(row: UnknownRecord, index: number) {
  return {
    fields: compactFields([
      field("Fuso", asText(row.timezone)),
      field("Criado", formatDate(row.created_at)),
      field("Atualizado", formatDate(row.updated_at)),
    ]),
    id: asText(row.id) || `patient-${index}`,
    subtitle: asText(row.user_id),
    title: asText(row.display_name) || "Paciente sem nome",
  } satisfies AdminOperationRow;
}

function mapSessionRow(row: UnknownRecord, index: number) {
  return {
    fields: compactFields([
      field("Pagamento", asText(row.payment_status)),
      field("Início", formatDate(row.starts_at)),
      field("Término", formatDate(row.ends_at)),
      field("Fuso", asText(row.timezone)),
      field("Duração", formatMinutes(row.service_duration_minutes_snapshot)),
      field("Atualizada", formatDate(row.updated_at)),
    ]),
    id: asText(row.id) || `session-${index}`,
    statusLabel: asText(row.status),
    subtitle: `Booking ${shortId(asText(row.id))}`,
    title: asText(row.service_title_snapshot) || "Sessão sem título",
  } satisfies AdminOperationRow;
}

function mapSupportRow(row: UnknownRecord, index: number) {
  return {
    fields: compactFields([
      field("Categoria", asText(row.category)),
      field("Prioridade", asText(row.priority)),
      field("Urgência", asText(row.urgency)),
      field("Origem", asText(row.source)),
      field("Criado", formatDate(row.created_at)),
      field("Atualizado", formatDate(row.updated_at)),
    ]),
    id: asText(row.id) || `support-${index}`,
    statusLabel: asText(row.status),
    subtitle: `Ticket ${shortId(asText(row.id))}`,
    title: asText(row.subject) || "Ticket sem assunto",
  } satisfies AdminOperationRow;
}

function mapReviewRow(row: UnknownRecord, index: number) {
  return {
    fields: compactFields([
      field("Nota", asText(row.rating)),
      field("Publicada", formatDate(row.published_at)),
      field("Criada", formatDate(row.created_at)),
      field("Atualizada", formatDate(row.updated_at)),
      field("Motivo de moderação", asText(row.moderation_reason)),
    ]),
    id: asText(row.id) || `review-${index}`,
    statusLabel: asText(row.status),
    subtitle: `Review ${shortId(asText(row.id))}`,
    title: "Avaliação operacional",
  } satisfies AdminOperationRow;
}

function compactFields(fields: Array<AdminOperationField | null>) {
  return fields.filter(Boolean) as AdminOperationField[];
}

function field(label: string, value: string) {
  return value ? { label, value } : null;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asText(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function asBooleanLabel(value: unknown) {
  if (value === true) return "Sim";
  if (value === false) return "Não";

  return "";
}

function formatMinutes(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";

  return `${value} min`;
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function shortId(value: string) {
  return value ? value.slice(0, 8) : "sem-id";
}
