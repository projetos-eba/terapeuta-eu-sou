import type { Metadata } from "next";

import { ResetPasswordClient } from "./reset-password-client";

export const metadata: Metadata = {
  description: "Recuperacao de senha do Terapeuta Eu Sou.",
  other: {
    referrer: "no-referrer",
  },
  robots: {
    follow: false,
    index: false,
  },
  title: "Recuperar senha | Terapeuta Eu Sou",
};

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: { token?: string };
}) {
  return <ResetPasswordClient token={searchParams?.token ?? ""} />;
}
