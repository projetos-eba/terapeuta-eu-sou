import type { Metadata } from "next";

import {
  TherapistAuthShell,
  TherapistLoginForm,
} from "@/features/therapist-auth";

export const metadata: Metadata = {
  description:
    "Login separado para terapeutas acessarem a área profissional do Terapeuta Eu Sou.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Login de terapeuta | Terapeuta Eu Sou",
};

export default async function TherapistLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{
    created?: string;
    next?: string;
    reset?: string;
    reason?: string;
    verified?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <TherapistAuthShell
      alwaysFallback
      eyebrow="Para terapeutas"
      title="Seu espaço começa aqui"
      description="Acesse sua área profissional e acompanhe sua rotina com clareza."
    >
      <div className="w-full">
        <TherapistLoginForm
          continuation={params?.next}
          created={params?.created === "1"}
          reset={params?.reset === "1"}
          sessionChanged={params?.reason === "session_changed"}
          verified={params?.verified === "1"}
        />
      </div>
    </TherapistAuthShell>
  );
}
