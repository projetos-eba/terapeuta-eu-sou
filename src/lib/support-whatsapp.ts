const TES_SUPPORT_WHATSAPP_NUMBER = "5518981058337";

type SupportContext = "waiting_room" | "in_call";

export function getSupportWhatsAppHref(
  context: SupportContext,
  bookingId?: string,
): string {
  const reference = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId ?? "")
    ? ` Referência TES: ${bookingId?.slice(0, 8).toUpperCase()}.`
    : "";
  const message =
    context === "waiting_room"
      ? "Olá, preciso de ajuda para entrar no meu encontro online no TES."
      : "Olá, preciso de suporte durante meu encontro online no TES.";

  return `https://wa.me/${TES_SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message + reference)}`;
}
