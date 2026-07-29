import type { Metadata } from "next";

import { ReservationSuccessPage } from "@/features/public-reservation";

export const metadata: Metadata = {
  description:
    "Confirmação da reserva online no Terapeuta Eu Sou após pagamento seguro.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Reserva em andamento | Terapeuta Eu Sou",
};

export const dynamic = "force-dynamic";

export default function PublicReservationSuccessPage() {
  return <ReservationSuccessPage />;
}
