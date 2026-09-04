const PAYOUT_TIMEZONE = "America/Sao_Paulo";

export function resolveWeeklyPayoutStartWindow(instant: string) {
  const value = new Date(instant);
  if (!Number.isFinite(value.getTime())) {
    throw new Error("Invalid weekly payout instant.");
  }

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      timeZone: PAYOUT_TIMEZONE,
      weekday: "short",
      year: "numeric",
    })
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour);

  return {
    businessDate: `${parts.year}-${parts.month}-${parts.day}`,
    open: parts.weekday === "Tue" && hour >= 2 && hour < 4,
  };
}
