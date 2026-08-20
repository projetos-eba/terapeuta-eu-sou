import type { Metadata } from "next";

import { ResetPasswordClient } from "./reset-password-client";

export const metadata: Metadata = {
  description: "Recuperação de senha do Terapeuta Eu Sou.",
  other: {
    referrer: "no-referrer",
  },
  robots: {
    follow: false,
    index: false,
  },
  title: "Recuperar senha | Terapeuta Eu Sou",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const params = await searchParams;

  return <ResetPasswordClient token={params?.token ?? ""} />;
}
