import { TherapistStatus } from "@/domain/tes";
import {
  createEmptyTherapistDashboardData,
  getTherapistHomeReadiness,
  getTherapistDashboardPage,
  TherapistDashboardError,
  TherapistDashboardPage,
} from "@/features/therapist-dashboard";
import { TherapistGettingStartedPage } from "@/features/therapist-dashboard/therapist-getting-started-page";
import { requireTherapistSession } from "@/lib/auth/therapist-session";

export default async function TherapistHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ onboarding?: string }>;
}) {
  const session = await requireTherapistSession();
  const params = await searchParams;
  let readiness;

  try {
    readiness = await getTherapistHomeReadiness({ session });
  } catch (error) {
    const message =
      error instanceof TherapistDashboardError &&
      error.code === "session_expired"
        ? "Sua sessão expirou. Entre novamente para continuar."
        : "Não foi possível carregar seu progresso agora. Tente novamente em alguns instantes.";

    return <TherapistHomeError message={message} />;
  }

  if (!readiness.isOperationallyReady) {
    return (
      <TherapistGettingStartedPage
        attentionMessage={
          params?.onboarding === "receiving-account"
            ? "Conclua o cadastro da sua conta de recebimento para acessar a agenda e iniciar atendimentos."
            : undefined
        }
        readiness={readiness}
        session={session}
      />
    );
  }

  if (session.status !== TherapistStatus.Approved) {
    return (
      <TherapistDashboardPage
        data={createEmptyTherapistDashboardData({ readiness, session })}
      />
    );
  }

  try {
    const data = await getTherapistDashboardPage({
      accessToken: session.accessToken,
      avatarUrl: session.avatarUrl,
      name: session.name,
      plan: session.plan,
      profileCompleteness: readiness.profileCompleteness,
      profileId: session.profileId,
    });

    return <TherapistDashboardPage data={data} />;
  } catch (error) {
    const message =
      error instanceof TherapistDashboardError &&
      error.code === "session_expired"
        ? "Sua sessão expirou. Entre novamente para continuar."
        : "Não foi possível carregar seu painel agora. Tente novamente em alguns instantes.";

    return <TherapistHomeError message={message} />;
  }
}

function TherapistHomeError({ message }: { message: string }) {
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
