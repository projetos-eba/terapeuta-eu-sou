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

export default function TherapistLoginPage({
  searchParams,
}: {
  searchParams?: {
    created?: string;
    next?: string;
    reset?: string;
    verified?: string;
  };
}) {
  return (
    <TherapistAuthShell
      eyebrow="Acesso profissional"
      title="Entre para cuidar da sua rotina."
      description="Este login é separado do acesso de pacientes para manter perfis, permissões e passos profissionais bem definidos."
    >
      <div className="w-full">
        <TherapistLoginForm
          continuation={searchParams?.next}
          created={searchParams?.created === "1"}
          reset={searchParams?.reset === "1"}
          verified={searchParams?.verified === "1"}
        />
      </div>
    </TherapistAuthShell>
  );
}
