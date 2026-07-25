import { EmailConfigurationError, EmailSkippedError } from "./errors.ts";
import type {
  EmailActionKey,
  EmailActionSettingRow,
  SenderProfileRow,
} from "./types.ts";

type RestClient = {
  get<T>(path: string): Promise<T>;
};

export async function resolveSender(
  client: RestClient,
  actionKey: EmailActionKey,
) {
  const settings = await client.get<EmailActionSettingRow[]>(
    `/rest/v1/email_action_settings?select=action_key,enabled,sender_profile_id,email_sender_profiles(*)&action_key=eq.${encodeURIComponent(
      actionKey,
    )}&limit=1`,
  );
  const setting = settings[0];

  if (setting?.enabled === false) {
    throw new EmailSkippedError("action_disabled");
  }

  const configuredSender = setting?.email_sender_profiles;
  if (isUsableSender(configuredSender)) {
    return configuredSender;
  }

  const defaults = await client.get<SenderProfileRow[]>(
    "/rest/v1/email_sender_profiles?select=*&active=eq.true&is_default=eq.true&limit=1",
  );
  const fallback = defaults[0];

  if (isUsableSender(fallback)) {
    return fallback;
  }

  throw new EmailConfigurationError("No active sender profile is configured.");
}

function isUsableSender(
  sender: SenderProfileRow | null | undefined,
): sender is SenderProfileRow {
  return Boolean(sender?.active && sender.mailbox_resource_id);
}
