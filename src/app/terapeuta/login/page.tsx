import type { Metadata } from "next";

import {
  TherapistAuthShell,
  TherapistLoginForm,
} from "@/features/therapist-auth";

export const metadata: Metadata = {
  description:
    "Login separado para terapeutas acessarem a area profissional do Terapeuta Eu Sou.",
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
  };
}) {
  return (
    <TherapistAuthShell
      eyebrow="Acesso profissional"
      title="Entre para cuidar da sua rotina."
      description="Este login e separado do acesso de pacientes para manter perfis, permissoes e onboarding profissional bem definidos."
      className="flex items-center"
    >
      <div className="w-full">
        <TherapistLoginForm created={searchParams?.created === "1"} />
      </div>
    </TherapistAuthShell>
  );
}
