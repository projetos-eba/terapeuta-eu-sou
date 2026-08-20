import { EmailProviderError, EmailSkippedError } from "./errors.ts";
import type { EmailProvider } from "./provider.ts";
import { logEmailDelivery } from "./logging.ts";
import { resolveEmailActionSetting, resolveSender } from "./sender-resolver.ts";
import { renderEmailTemplate } from "./templates.ts";
import type {
  SendTransactionalEmailInput,
  SendTransactionalEmailResult,
} from "./types.ts";
import { assertSafeEmail, sanitizeHeaderText } from "./validation.ts";

type RestClient = {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown, prefer?: string): Promise<T>;
};

export async function sendTransactionalEmail(
  client: RestClient,
  provider: EmailProvider,
  input: SendTransactionalEmailInput,
): Promise<SendTransactionalEmailResult> {
  const correlationId = input.correlationId ?? crypto.randomUUID();
  assertSafeEmail(input.recipient.email);

  let subject: string | null = null;
  let sender = null;

  try {
    const setting = await resolveEmailActionSetting(client, input.actionKey);
    if (input.dispatchMode !== "manual" && setting?.automatic_dispatch_enabled === false) {
      throw new EmailSkippedError("automatic_dispatch_disabled");
    }
    sender = await resolveSender(client, input.actionKey, setting);
    const rendered = renderEmailTemplate(input.actionKey, input.templateData, setting);
    subject = sanitizeHeaderText(rendered.subject);
    const result = await provider.send({
      correlationId,
      from: {
        displayName: sender.display_name,
        mailboxAddress: sender.mailbox_address,
        mailboxResourceId: sender.mailbox_resource_id,
        replyToEmail: sender.reply_to_email,
      },
      html: rendered.html,
      subject,
      text: rendered.text,
      to: input.recipient,
    });

    await logEmailDelivery(client, {
      actionKey: input.actionKey,
      attemptCount: result.attemptCount,
      correlationId,
      providerMessageId: result.messageId,
      recipientEmail: input.recipient.email,
      recipientRole: input.recipientRole,
      recipientUserId: input.recipientUserId,
      relatedEntityId: input.relatedEntityId,
      relatedEntityType: input.relatedEntityType,
      sender,
      status: "success",
      subject,
    });

    return { correlationId, ok: true, status: "success" };
  } catch (error) {
    const isSkipped = error instanceof EmailSkippedError;
    const providerError =
      error instanceof EmailProviderError ? error : undefined;

    await logEmailDelivery(client, {
      actionKey: input.actionKey,
      attemptCount: providerError?.attemptCount ?? 0,
      correlationId,
      errorMessage: isSkipped
        ? error.reason
        : providerError
          ? "Transactional email could not be sent."
          : safeErrorMessage(error),
      providerErrorCode: providerError?.code,
      recipientEmail: input.recipient.email,
      recipientRole: input.recipientRole,
      recipientUserId: input.recipientUserId,
      relatedEntityId: input.relatedEntityId,
      relatedEntityType: input.relatedEntityType,
      sender,
      status: isSkipped ? "skipped" : "error",
      subject,
    });

    return {
      correlationId,
      ok: isSkipped,
      status: isSkipped ? "skipped" : "error",
    };
  }
}

function safeErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "transactional_email_failed";
  }

  return error.message.replace(/[\r\n]+/g, " ").slice(0, 160);
}
