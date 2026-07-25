import type { Metadata } from "next";

import {
  normalizeTherapistPlan,
  TherapistAuthShell,
  TherapistSignupForm,
} from "@/features/therapist-auth";

export const metadata: Metadata = {
  description:
    "Cadastro inicial para terapeutas criarem conta no Terapeuta Eu Sou e iniciarem os próximos passos profissionais.",
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
      title="Seu espaço profissional começa aqui."
      description="Cadastre-se para acessar sua área profissional no TES."
    >
      <TherapistSignupForm plan={plan} />
    </TherapistAuthShell>
  );
}
