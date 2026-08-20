export type UserRole = "patient" | "therapist" | "admin";

export type EmailActionKey =
  | "email_verification"
  | "password_reset"
  | "registration_completed"
  | "patient_welcome"
  | "therapist_welcome"
  | "password_changed"
  | "therapist_profile_submitted_for_review"
  | "therapist_documents_requested"
  | "therapist_profile_approved"
  | "therapist_profile_rejected"
  | "therapist_profile_suspended"
  | "therapist_profile_reactivated"
  | "booking_confirmed_patient"
  | "booking_confirmed_therapist"
  | "booking_cancelled_patient"
  | "booking_cancelled_therapist"
  | "booking_rescheduled_patient"
  | "booking_rescheduled_therapist"
  | "session_payment_approved"
  | "session_payment_declined"
  | "session_payment_pending"
  | "session_refund_approved"
  | "therapist_payout_completed"
  | "therapist_subscription_created"
  | "therapist_subscription_renewed"
  | "therapist_subscription_cancelled"
  | "therapist_subscription_plan_changed"
  | "therapy_catalog_request_submitted"
  | "therapy_catalog_request_updated";

export type EmailDeliveryStatus = "success" | "error" | "skipped";

export type EmailProviderKey = "hostinger_mail_api";

export type EmailRecipient = {
  email: string;
  name?: string | null;
};

export type EmailProviderSender = {
  mailboxResourceId: string;
  mailboxAddress: string;
  displayName: string;
  replyToEmail?: string | null;
};

export type EmailProviderSendInput = {
  from: EmailProviderSender;
  to: EmailRecipient;
  subject: string;
  html: string;
  text: string;
  correlationId: string;
};

export type EmailProviderSendResult = {
  messageId?: string | null;
  attemptCount: number;
};

export type SendTransactionalEmailInput = {
  actionKey: EmailActionKey;
  recipient: EmailRecipient;
  recipientUserId?: string | null;
  recipientRole?: UserRole | null;
  templateData: Record<string, unknown>;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  correlationId?: string | null;
  dispatchMode?: "automatic" | "manual";
  deliverySnapshot?: {
    senderProfileId: string | null;
    templateOverrides: Partial<EmailActionSettingRow>;
    templateVersion: string;
  };
};

export type SendTransactionalEmailResult = {
  ok: boolean;
  status: EmailDeliveryStatus;
  correlationId: string;
  deliveryOutcome?: "not_accepted" | "unknown";
};

export type SenderProfileRow = {
  id: string;
  provider: EmailProviderKey;
  mailbox_resource_id: string;
  mailbox_address: string;
  display_name: string;
  reply_to_email: string | null;
  active: boolean;
  is_default: boolean;
};

export type EmailActionSettingRow = {
  action_key: string;
  sender_profile_id: string | null;
  enabled: boolean;
  automatic_dispatch_enabled?: boolean;
  subject_override?: string | null;
  preheader_override?: string | null;
  text_override?: string | null;
  html_override?: string | null;
  email_sender_profiles?: SenderProfileRow | null;
};
