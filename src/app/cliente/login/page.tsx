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

export default async function ClientLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{
    created?: string;
    reset?: string;
    next?: string;
    verified?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <ClientAuthShell>
      <div className="pointer-events-none flex min-h-full w-full items-center">
        <div className="pointer-events-auto w-full">
          <ClientLoginForm
            created={params?.created === "1"}
            next={params?.next}
            reset={params?.reset === "1"}
            verified={params?.verified === "1"}
          />
        </div>
      </div>
    </ClientAuthShell>
  );
}
