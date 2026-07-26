export function formatSessionDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: normalizeTimeZone(timezone),
  }).format(new Date(value));
}

export function formatSessionMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "BRL",
    style: "currency",
  }).format(amountCents / 100);
}

export function normalizeTimeZone(timezone: string) {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: timezone }).format();
    return timezone;
  } catch {
    return "America/Sao_Paulo";
  }
}
