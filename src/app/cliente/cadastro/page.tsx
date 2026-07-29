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

export default async function ClientSignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  return (
    <ClientAuthShell>
      <ClientSignupForm next={params?.next} />
    </ClientAuthShell>
  );
}
