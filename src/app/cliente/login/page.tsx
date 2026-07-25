import type { Metadata } from "next";

import { ClientAuthShell, ClientLoginForm } from "@/features/client-auth";

export const metadata: Metadata = {
  description:
    "Login separado para clientes acessarem sua jornada no Terapeuta Eu Sou.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Login de cliente | Terapeuta Eu Sou",
};

export default function ClientLoginPage({
  searchParams,
}: {
  searchParams?: {
    created?: string;
    reset?: string;
    verified?: string;
  };
}) {
  return (
    <ClientAuthShell className="flex items-center">
      <div className="w-full">
        <ClientLoginForm
          created={searchParams?.created === "1"}
          reset={searchParams?.reset === "1"}
          verified={searchParams?.verified === "1"}
        />
      </div>
    </ClientAuthShell>
  );
}
