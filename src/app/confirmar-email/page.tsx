import type { Metadata } from "next";

import { ConfirmEmailClient } from "./confirm-email-client";

export const metadata: Metadata = {
  description: "Confirmacao de e-mail do Terapeuta Eu Sou.",
  other: {
    referrer: "no-referrer",
  },
  robots: {
    follow: false,
    index: false,
  },
  title: "Confirmar e-mail | Terapeuta Eu Sou",
};

export default function ConfirmEmailPage({
  searchParams,
}: {
  searchParams?: { statusToken?: string; token?: string };
}) {
  return (
    <ConfirmEmailClient
      statusToken={searchParams?.statusToken ?? ""}
      token={searchParams?.token ?? ""}
    />
  );
}
