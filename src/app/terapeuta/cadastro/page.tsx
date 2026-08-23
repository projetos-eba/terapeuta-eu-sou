import type { Metadata } from "next";

import { AuthBackButton, PublicLogo } from "@/components/tes";
import { TherapistPlan } from "@/domain/tes";
import {
  normalizeTherapistPlan,
  TherapistAuthShell,
  TherapistPlanSelection,
  TherapistSignupForm,
} from "@/features/therapist-auth";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  description:
    "Cadastro inicial para terapeutas criarem conta no Terapeuta Eu Sou e iniciarem os próximos passos profissionais.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Cadastro de terapeuta | Terapeuta Eu Sou",
};

export default async function TherapistSignupPage({
  searchParams,
}: {
  searchParams?: Promise<{
    plan?: string;
  }>;
}) {
  const params = await searchParams;
  const requestedPlan = params?.plan;

  if (
    requestedPlan !== TherapistPlan.Free &&
    requestedPlan !== TherapistPlan.Premium &&
    requestedPlan !== TherapistPlan.PremiumPlus
  ) {
    return (
      <main className="relative min-h-screen bg-surface-soft px-5 py-8 text-brand-deep sm:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col items-center justify-center gap-8">
          <div className="relative flex w-full justify-center">
            <AuthBackButton fallbackHref={routes.public.forTherapists} />
            <PublicLogo />
          </div>
          <TherapistPlanSelection />
        </div>
      </main>
    );
  }

  const plan = normalizeTherapistPlan(requestedPlan);

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
