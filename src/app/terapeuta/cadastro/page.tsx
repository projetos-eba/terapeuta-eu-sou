import type { Metadata } from "next";

import {
  normalizeTherapistPlan,
  TherapistAuthShell,
  TherapistSignupForm,
} from "@/features/therapist-auth";

export const metadata: Metadata = {
  description:
    "Cadastro inicial para terapeutas criarem conta no Terapeuta Eu Sou e iniciarem o onboarding profissional.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Cadastro de terapeuta | Terapeuta Eu Sou",
};

export default function TherapistSignupPage({
  searchParams,
}: {
  searchParams?: {
    plan?: string;
  };
}) {
  const plan = normalizeTherapistPlan(searchParams?.plan);

  return (
    <TherapistAuthShell
      eyebrow="Para terapeutas"
      title="Seu espaco profissional comeca aqui."
      description="Crie sua conta para acessar a area do terapeuta. Perfil publico, documentos e dados bancarios entram depois, no seu onboarding."
    >
      <TherapistSignupForm plan={plan} />
    </TherapistAuthShell>
  );
}
