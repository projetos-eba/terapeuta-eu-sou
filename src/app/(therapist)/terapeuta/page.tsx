import { TherapistPlan } from "@/domain/tes";
import {
  getTherapistDashboardPage,
  TherapistDashboardError,
  TherapistDashboardPage,
} from "@/features/therapist-dashboard";
import { TherapistConstructionPage } from "@/features/therapist-shell";
import { requireTherapistSession } from "@/lib/auth/therapist-session";

export default async function TherapistHomePage() {
  const session = await requireTherapistSession();

  if (session.plan !== TherapistPlan.PremiumPlus) {
    return <TherapistConstructionPage title="Início" />;
  }

  try {
    const data = await getTherapistDashboardPage({
      accessToken: session.accessToken,
      profileId: session.profileId,
    });

    return <TherapistDashboardPage data={data} />;
  } catch (error) {
    const message =
      error instanceof TherapistDashboardError &&
      error.code === "session_expired"
        ? "Sua sessão expirou. Entre novamente para continuar."
        : "Não foi possível carregar seu painel agora. Tente novamente em alguns instantes.";

    return (
      <section className="mx-auto max-w-[920px] rounded-panel border border-[var(--tes-color-border)] bg-white p-8 text-center shadow-card">
        <h1 className="font-display text-4xl font-light italic text-brand-deep">
          Seu painel está temporariamente indisponível
        </h1>
        <p className="mt-4 text-sm leading-6 text-tesText-secondary">
          {message}
        </p>
      </section>
    );
  }
}
