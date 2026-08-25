import {
  attachmentMimeTypeIsAllowed,
  sanitizeSupportAttachmentName,
  supportTicketAttachmentLimit,
  supportTicketAttachmentMimeTypes,
  supportTicketAttachmentSizeLimit,
  type SupportTicketAttachmentDescriptor,
} from "./support-contracts";

const bucket = "support-ticket-attachments";

type StorageConfig = {
  apiKey: string;
  url: string;
};

export type SupportAttachmentFile = {
  file: File;
  name: string;
};

export function readSupportAttachmentFiles(formData: FormData) {
  const values = formData.getAll("attachments");
  const files: SupportAttachmentFile[] = [];

  for (const value of values) {
    if (typeof File === "undefined" || !(value instanceof File)) {
      return { error: "Selecione arquivos válidos.", files: [] };
    }
    if (value.size === 0) continue;
    if (value.size > supportTicketAttachmentSizeLimit) {
      return {
        error: `Cada anexo deve ter no máximo ${formatMegabytes(supportTicketAttachmentSizeLimit)}.`,
        files: [],
      };
    }
    if (!attachmentMimeTypeIsAllowed(value.type)) {
      return {
        error: `Formato não permitido. Use ${supportTicketAttachmentMimeTypes.map(formatMimeType).join(", ")}.`,
        files: [],
      };
    }
    files.push({
      file: value,
      name: sanitizeSupportAttachmentName(value.name),
    });
  }

  if (files.length > supportTicketAttachmentLimit) {
    return {
      error: `Você pode enviar até ${supportTicketAttachmentLimit} anexos por vez.`,
      files: [],
    };
  }

  return { error: null, files };
}

export async function uploadSupportAttachments(input: {
  accessToken: string;
  config: StorageConfig;
  files: SupportAttachmentFile[];
  requestId: string;
  ticketId: string;
}) {
  const uploadedPaths: string[] = [];
  const descriptors: SupportTicketAttachmentDescriptor[] = [];

  try {
    for (const [index, item] of input.files.entries()) {
      const objectPath = [
        input.ticketId,
        input.requestId,
        `${String(index + 1).padStart(2, "0")}-${crypto.randomUUID()}-${item.name}`,
      ].join("/");
      const response = await fetch(
        `${input.config.url}/storage/v1/object/${bucket}/${encodeStoragePath(objectPath)}`,
        {
          body: new Uint8Array(await item.file.arrayBuffer()),
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${input.accessToken}`,
            "Content-Type": item.file.type,
            apikey: input.config.apiKey,
            "x-upsert": "false",
          },
          method: "POST",
        },
      );

      if (!response.ok) throw new Error("Support attachment upload failed");
      uploadedPaths.push(objectPath);
      descriptors.push({
        mimeType: item.file
          .type as SupportTicketAttachmentDescriptor["mimeType"],
        originalName: item.name,
        sizeBytes: item.file.size,
        storageObjectPath: objectPath,
      });
    }

    return { descriptors, uploadedPaths };
  } catch (error) {
    await removeSupportAttachments(
      input.config,
      input.accessToken,
      uploadedPaths,
    );
    throw error;
  }
}

export async function removeSupportAttachments(
  config: StorageConfig,
  accessToken: string,
  objectPaths: string[],
) {
  if (objectPaths.length === 0) return;
  await fetch(`${config.url}/storage/v1/object/remove`, {
    body: JSON.stringify({
      prefixes: objectPaths.map((path) => `${bucket}/${path}`),
    }),
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      apikey: config.apiKey,
    },
    method: "POST",
  }).catch(() => undefined);
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function formatMegabytes(value: number) {
  return `${Math.round(value / 1024 / 1024)} MB`;
}

function formatMimeType(value: string) {
  return value === "application/pdf"
    ? "PDF"
    : value.replace("image/", "").toUpperCase();
}
