import type {
  EmailActionKey,
  EmailDeliveryStatus,
  SenderProfileRow,
  UserRole,
} from "./types.ts";

type RestClient = {
  post<T>(path: string, body: unknown, prefer?: string): Promise<T>;
};

export async function logEmailDelivery(
  client: RestClient,
  input: {
    actionKey: EmailActionKey;
    attemptCount?: number;
    correlationId: string;
    errorMessage?: string | null;
    providerErrorCode?: string | null;
    providerMessageId?: string | null;
    recipientEmail: string;
    recipientRole?: UserRole | null;
    recipientUserId?: string | null;
    relatedEntityId?: string | null;
    relatedEntityType?: string | null;
    sender?: SenderProfileRow | null;
    status: EmailDeliveryStatus;
    subject?: string | null;
  },
) {
  await client.post(
    "/rest/v1/email_delivery_logs",
    {
      action_key: input.actionKey,
      attempt_count: input.attemptCount ?? 0,
      correlation_id: input.correlationId,
      error_message: sanitizeLogText(input.errorMessage),
      provider_error_code: sanitizeLogText(input.providerErrorCode),
      provider_message_id: sanitizeLogText(input.providerMessageId),
      recipient_email: input.recipientEmail,
      recipient_role: input.recipientRole ?? null,
      recipient_user_id: input.recipientUserId ?? null,
      related_entity_id: input.relatedEntityId ?? null,
      related_entity_type: input.relatedEntityType ?? null,
      sender_profile_id: input.sender?.id ?? null,
      sent_at: input.status === "success" ? new Date().toISOString() : null,
      status: input.status,
      subject: sanitizeLogText(input.subject),
    },
    "return=minimal",
  );
}

function sanitizeLogText(value: string | null | undefined) {
  if (!value) return null;
  return value.replace(/[\r\n]+/g, " ").slice(0, 500);
}
