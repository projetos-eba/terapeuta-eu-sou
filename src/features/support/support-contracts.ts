export const supportTicketCategories = [
  "agenda_sessoes",
  "zoom_acesso",
  "pagamentos",
  "financeiro_repasses",
  "plano_assinatura",
  "perfil_verificacao",
  "conta_acesso",
  "outro",
] as const;

export const supportTicketSources = [
  "message_center",
  "encounter_detail",
  "waiting_room",
  "public_help",
] as const;

export const supportTicketStatuses = [
  "open",
  "in_progress",
  "waiting_requester",
  "waiting_support",
  "resolved",
] as const;

export const supportTicketBodyLimit = 4_000;
export const supportTicketSubjectLimit = 120;
export const supportTicketAttachmentLimit = 5;
export const supportTicketAttachmentSizeLimit = 10 * 1024 * 1024;
export const supportTicketAttachmentMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type SupportTicketCategory = (typeof supportTicketCategories)[number];
export type SupportTicketSource = (typeof supportTicketSources)[number];
export type SupportTicketStatus = (typeof supportTicketStatuses)[number];
export type SupportTicketVisibility = "internal" | "requester";

export type SupportTicketAttachment = {
  downloadPath: string;
  fileName: string;
  id: string;
  mimeType: (typeof supportTicketAttachmentMimeTypes)[number];
  sizeBytes: number;
};

export type SupportTicketAttachmentDescriptor = {
  mimeType: (typeof supportTicketAttachmentMimeTypes)[number];
  originalName: string;
  sizeBytes: number;
  storageObjectPath: string;
};

export type SupportTicketAttachmentInput = Omit<
  SupportTicketAttachmentDescriptor,
  "storageObjectPath"
>;

export type SupportTicketCreateContract = {
  bookingId: string | null;
  category: SupportTicketCategory;
  description: string;
  requestId: string;
  source: SupportTicketSource;
  subject: string;
};

export type SupportTicketThreadMessageContract = {
  body: string;
  requestId: string;
  visibility: SupportTicketVisibility;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const markup = /<\/?[a-z][^>]*>/i;

export function parseFutureSupportTicketCreate(
  value: unknown,
): SupportTicketCreateContract | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (Object.prototype.hasOwnProperty.call(value, "actorRole")) return null;

  const bookingId = Reflect.get(value, "bookingId");
  const category = Reflect.get(value, "category");
  const description = normalizePlainText(
    Reflect.get(value, "description"),
    true,
  );
  const requestId = Reflect.get(value, "requestId");
  const source = Reflect.get(value, "source");
  const subject = normalizePlainText(Reflect.get(value, "subject"), false);

  if (
    typeof requestId !== "string" ||
    !UUID.test(requestId) ||
    !isOneOf(category, supportTicketCategories) ||
    !isOneOf(source, supportTicketSources) ||
    subject === null ||
    description === null ||
    subject.length < 3 ||
    subject.length > supportTicketSubjectLimit ||
    description.length === 0 ||
    description.length > supportTicketBodyLimit
  ) {
    return null;
  }

  if (bookingId !== null && bookingId !== undefined) {
    if (typeof bookingId !== "string" || !UUID.test(bookingId)) return null;
  }

  return {
    bookingId: typeof bookingId === "string" ? bookingId : null,
    category,
    description,
    requestId,
    source,
    subject,
  };
}

export function normalizePlainText(value: unknown, preserveNewlines: boolean) {
  if (typeof value !== "string") return null;
  const normalized = value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  if (markup.test(normalized)) return null;
  return preserveNewlines
    ? normalized.replace(/[^\S\n]+/g, " ")
    : normalized.replace(/\s+/g, " ");
}

export function sanitizeSupportAttachmentName(value: string) {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\\/\u0000-\u001f\u007f]+/g, "-")
    .replace(/[^\p{L}\p{N}._ -]/gu, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return normalized || "anexo";
}

export function attachmentMimeTypeIsAllowed(
  value: string,
): value is SupportTicketAttachment["mimeType"] {
  return (supportTicketAttachmentMimeTypes as readonly string[]).includes(
    value,
  );
}

export function parseSupportTicketAttachmentInputs(
  value: unknown,
): SupportTicketAttachmentInput[] | null {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > supportTicketAttachmentLimit
  ) {
    return null;
  }

  const attachments: SupportTicketAttachmentInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const mimeType = Reflect.get(item, "mimeType");
    const originalName = Reflect.get(item, "originalName");
    const sizeBytes = Reflect.get(item, "sizeBytes");
    if (
      typeof originalName !== "string" ||
      typeof sizeBytes !== "number" ||
      !Number.isInteger(sizeBytes) ||
      sizeBytes < 1 ||
      sizeBytes > supportTicketAttachmentSizeLimit ||
      !attachmentMimeTypeIsAllowed(typeof mimeType === "string" ? mimeType : "")
    ) {
      return null;
    }
    attachments.push({
      mimeType,
      originalName: sanitizeSupportAttachmentName(originalName),
      sizeBytes,
    });
  }
  return attachments;
}

export function parseSupportTicketAttachmentDescriptors(
  value: unknown,
): SupportTicketAttachmentDescriptor[] | null {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > supportTicketAttachmentLimit
  ) {
    return null;
  }

  const attachments: SupportTicketAttachmentDescriptor[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const parsed = parseSupportTicketAttachmentInputs([item]);
    const storageObjectPath = Reflect.get(item, "storageObjectPath");
    if (
      !parsed ||
      typeof storageObjectPath !== "string" ||
      !storageObjectPath
    ) {
      return null;
    }
    attachments.push({ ...parsed[0], storageObjectPath });
  }
  return attachments;
}

function isOneOf<const T extends readonly string[]>(
  value: unknown,
  values: T,
): value is T[number] {
  return typeof value === "string" && values.includes(value);
}
