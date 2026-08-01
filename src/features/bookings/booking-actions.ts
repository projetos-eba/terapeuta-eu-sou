import type { Route } from "next";

import { routes } from "@/lib/routes";

export const encounterMoreActions = [
  {
    href: (bookingId: string) => routes.patient.encounterDetail(bookingId),
    label: "Ver detalhes",
  },
  {
    href: () => routes.patient.messages,
    label: "Enviar mensagem",
  },
  {
    href: (bookingId: string) => routes.patient.encounterDetail(bookingId),
    label: "Reagendar",
  },
  {
    href: (bookingId: string) =>
      `${routes.patient.messages}?context=suporte&booking=${bookingId}`,
    label: "Pedir ajuda",
  },
] satisfies Array<{
  href: (bookingId: string) => Route<string> | string;
  label: string;
}>;
