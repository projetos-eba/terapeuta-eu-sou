import {
  sanitizeSupportAttachmentName,
  type SupportTicketAttachmentDescriptor,
} from "./support-contracts";

type UploadPlan = SupportTicketAttachmentDescriptor & { signedUrl: string };

export async function prepareAndUploadSupportAttachments(input: {
  actorRole: "patient" | "therapist";
  files: File[];
  requestId: string;
  ticketId: string;
}) {
  const response = await fetch(
    `/api/support/tickets/${input.ticketId}/attachments`,
    {
      body: JSON.stringify({
        action: "prepare",
        actorRole: input.actorRole,
        attachments: input.files.map((file) => ({
          mimeType: file.type,
          originalName: sanitizeSupportAttachmentName(file.name),
          sizeBytes: file.size,
        })),
        requestId: input.requestId,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    uploads?: UploadPlan[];
  } | null;
  if (
    !response.ok ||
    !payload?.uploads ||
    !uploadPlansMatchFiles(payload.uploads, input.files)
  ) {
    throw new SupportAttachmentUploadError(
      payload?.error?.message ?? "Não foi possível preparar os anexos agora.",
    );
  }

  const uploadedAttachments: SupportTicketAttachmentDescriptor[] = [];
  try {
    for (const [index, upload] of payload.uploads.entries()) {
      await uploadToSignedUrl(input.files[index]!, upload.signedUrl);
      uploadedAttachments.push(toAttachmentDescriptor(upload));
    }
    return uploadedAttachments;
  } catch {
    if (uploadedAttachments.length > 0) {
      await cleanupSupportAttachments({
        actorRole: input.actorRole,
        attachments: uploadedAttachments,
        requestId: input.requestId,
        ticketId: input.ticketId,
      });
    }
    throw new SupportAttachmentUploadError(
      "Não foi possível enviar todos os anexos agora. Tente novamente.",
    );
  }
}

export async function completeSupportAttachmentUpload(input: {
  actorRole: "patient" | "therapist";
  attachments: SupportTicketAttachmentDescriptor[];
  requestId: string;
  ticketId: string;
}) {
  const response = await fetch(
    `/api/support/tickets/${input.ticketId}/attachments`,
    {
      body: JSON.stringify({ ...input, action: "complete" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    ok?: boolean;
  } | null;
  if (!response.ok || !payload?.ok) {
    throw new SupportAttachmentUploadError(
      payload?.error?.message ??
        "Não foi possível concluir o envio dos anexos agora.",
    );
  }
}

export async function cleanupSupportAttachments(input: {
  actorRole: "patient" | "therapist";
  attachments: SupportTicketAttachmentDescriptor[];
  requestId: string;
  ticketId: string;
}) {
  await fetch(`/api/support/tickets/${input.ticketId}/attachments`, {
    body: JSON.stringify({ ...input, action: "cleanup" }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).catch(() => undefined);
}

export class SupportAttachmentUploadError extends Error {}

function uploadPlansMatchFiles(uploads: UploadPlan[], files: File[]) {
  if (uploads.length !== files.length) return false;

  const storageObjectPaths = new Set<string>();
  return uploads.every((upload, index) => {
    const file = files[index];
    if (!file || !upload.signedUrl || !upload.storageObjectPath) return false;
    if (storageObjectPaths.has(upload.storageObjectPath)) return false;
    storageObjectPaths.add(upload.storageObjectPath);
    return (
      upload.mimeType === file.type &&
      upload.originalName === sanitizeSupportAttachmentName(file.name) &&
      upload.sizeBytes === file.size
    );
  });
}

function toAttachmentDescriptor({
  signedUrl: _signedUrl,
  ...attachment
}: UploadPlan) {
  return attachment;
}

async function uploadToSignedUrl(file: File, signedUrl: string) {
  const formData = new FormData();
  formData.append("cacheControl", "3600");
  formData.append("", file);
  const response = await fetch(signedUrl, {
    body: formData,
    headers: { "x-upsert": "false" },
    method: "PUT",
  });
  if (!response.ok) throw new Error("Support signed upload failed");
}
