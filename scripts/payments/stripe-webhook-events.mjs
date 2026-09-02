export const platformSnapshotEvents = [
  "charge.refunded",
  "charge.dispute.closed",
  "charge.dispute.created",
  "charge.dispute.updated",
  "checkout.session.async_payment_failed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.completed",
  "checkout.session.expired",
  "customer.subscription.created",
  "customer.subscription.deleted",
  "customer.subscription.updated",
  "invoice.finalization_failed",
  "invoice.paid",
  "invoice.payment_action_required",
  "invoice.payment_failed",
  "payment_intent.amount_capturable_updated",
  "payment_intent.canceled",
  "payment_intent.payment_failed",
  "payment_intent.processing",
  "payment_intent.requires_action",
  "payment_intent.succeeded",
  "refund.created",
  "refund.failed",
  "refund.updated",
  "transfer.reversed",
  "transfer.updated",
];

export const connectSnapshotEvents = [
  "account.external_account.updated",
  "account.updated",
  "balance_settings.updated",
  "payout.canceled",
  "payout.created",
  "payout.failed",
  "payout.paid",
  "payout.updated",
];

export const connectThinEvents = [
  "v2.core.account.closed",
  "v2.core.account.created",
  "v2.core.account.updated",
  "v2.core.account[configuration.merchant].capability_status_updated",
  "v2.core.account[configuration.merchant].updated",
  "v2.core.account[configuration.recipient].capability_status_updated",
  "v2.core.account[configuration.recipient].updated",
  "v2.core.account[defaults].updated",
  "v2.core.account[future_requirements].updated",
  "v2.core.account[identity].updated",
  "v2.core.account[requirements].updated",
];

export const allSnapshotEvents = [
  ...new Set([...platformSnapshotEvents, ...connectSnapshotEvents]),
];
