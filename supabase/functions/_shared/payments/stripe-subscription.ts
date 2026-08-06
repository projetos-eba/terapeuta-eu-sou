export type StripeSubscriptionPeriod = {
  currentPeriodEnd: number | null;
  currentPeriodStart: number | null;
};

export function getStripeSubscriptionPeriod(
  subscription: Record<string, unknown>,
): StripeSubscriptionPeriod {
  const items = asRecord(subscription.items);
  const data = Array.isArray(items.data) ? items.data : [];
  const firstItem = asRecord(data[0]);

  return {
    currentPeriodEnd:
      numberOrNull(subscription.current_period_end) ??
      numberOrNull(firstItem.current_period_end),
    currentPeriodStart:
      numberOrNull(subscription.current_period_start) ??
      numberOrNull(firstItem.current_period_start),
  };
}

export function getStripeSubscriptionScheduleId(subscription: unknown) {
  const schedule = (subscription as { schedule?: unknown }).schedule;
  if (typeof schedule === "string") return schedule;
  if (schedule && typeof schedule === "object" && "id" in schedule) {
    const id = (schedule as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

export function getStripeInvoiceSubscriptionId(
  invoice: Record<string, unknown>,
) {
  const topLevelSubscription = stringOrNull(invoice.subscription);
  if (topLevelSubscription) return topLevelSubscription;

  const parent = asRecord(invoice.parent);
  const subscriptionDetails = asRecord(parent.subscription_details);
  const parentSubscription = stringOrNull(subscriptionDetails.subscription);
  if (parentSubscription) return parentSubscription;

  const lines = asRecord(invoice.lines);
  const data = Array.isArray(lines.data) ? lines.data : [];
  const firstLine = asRecord(data[0]);
  const lineParent = asRecord(firstLine.parent);
  const subscriptionItemDetails = asRecord(
    lineParent.subscription_item_details,
  );

  return stringOrNull(subscriptionItemDetails.subscription);
}

function numberOrNull(value: unknown) {
  return typeof value === "number" ? value : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
