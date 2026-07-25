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

export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams?: Promise<{ statusToken?: string; token?: string }>;
}) {
  const params = await searchParams;

  return (
    <ConfirmEmailClient
      statusToken={params?.statusToken ?? ""}
      token={params?.token ?? ""}
    />
  );
}
