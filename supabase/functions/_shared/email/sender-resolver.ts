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
  setting?: EmailActionSettingRow,
) {
  const resolvedSetting = setting ?? await resolveEmailActionSetting(client, actionKey);
  if (resolvedSetting?.enabled === false) {
    throw new EmailSkippedError("action_disabled");
  }

  const configuredSender = resolvedSetting?.email_sender_profiles;
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

export async function resolveEmailActionSetting(
  client: RestClient,
  actionKey: EmailActionKey,
) {
  const settings = await client.get<EmailActionSettingRow[]>(
    `/rest/v1/email_action_settings?select=action_key,enabled,automatic_dispatch_enabled,sender_profile_id,subject_override,preheader_override,text_override,html_override,email_sender_profiles(*)&action_key=eq.${encodeURIComponent(
      actionKey,
    )}&limit=1`,
  );
  return settings[0];
}

function isUsableSender(
  sender: SenderProfileRow | null | undefined,
): sender is SenderProfileRow {
  return Boolean(sender?.active && sender.mailbox_resource_id);
}
