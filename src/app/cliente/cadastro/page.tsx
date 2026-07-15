import type { Metadata } from "next";

import { ClientAuthShell, ClientSignupForm } from "@/features/client-auth";

export const metadata: Metadata = {
  description:
    "Cadastro inicial para clientes criarem conta no Terapeuta Eu Sou e seguirem sua jornada.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Cadastro de cliente | Terapeuta Eu Sou",
};

export default function ClientSignupPage() {
  return (
    <ClientAuthShell>
      <ClientSignupForm />
    </ClientAuthShell>
  );
}
