import type { Route } from "next";

import { routes } from "@/lib/routes";

export const encounterMoreActions = [
  {
    href: (bookingId: string) => routes.patient.sessionDetail(bookingId),
    label: "Ver detalhes",
  },
  {
    href: () => routes.patient.messages,
    label: "Enviar mensagem",
  },
  {
    href: () => routes.public.therapists,
    label: "Reagendar",
  },
  {
    href: () => routes.patient.help,
    label: "Pedir ajuda",
  },
] satisfies Array<{
  href: (bookingId: string) => Route<string> | string;
  label: string;
}>;
