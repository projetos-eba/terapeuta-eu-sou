import { notFound } from "next/navigation";
import { ShieldCheck, Video } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import {
  formatSessionDateTime,
  formatSessionMoney,
  getZoomAccessLabel,
  mapSessionPresentation,
} from "@/features/bookings";
import { SessionOperationActions } from "@/features/session-actions/session-operation-actions";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import {
  getTherapistSessionDetail,
  getTherapistSessionPendingReschedule,
} from "@/features/therapist-sessions";
import { requireTherapistSession } from "@/lib/auth/therapist-session";
import { routes } from "@/lib/routes";

export default async function TherapistSessionDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const session = await requireTherapistSession(
    therapistRoutePolicies.sessions,
  );
  const result = await getTherapistSessionDetail({
    accessToken: session.accessToken,
    bookingId,
    profileId: session.profileId,
  });

  if (result.status === "empty") notFound();

  if (result.status === "error") {
    return (
      <section
        className="rounded-card border border-status-error/30 bg-white p-8 text-center shadow-card"
        role="alert"
      >
        <h1 className="font-display text-4xl font-light italic text-brand-deep">
          Não foi possível abrir esta sessão
        </h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-tesText-secondary">
          {result.error.message}
        </p>
        <p className="mt-2 text-xs font-semibold text-tesText-muted">
          Referência: {result.error.correlationId.slice(0, 8)}
        </p>
      </section>
    );
  }

  const booking = result.data;
  const presentation = mapSessionPresentation(booking);
  const pendingReschedule = await getTherapistSessionPendingReschedule({
    accessToken: session.accessToken,
    bookingId,
    userId: session.userId,
  });

  return (
    <main className="grid gap-6 pb-10 text-tesText-primary xl:grid-cols-[minmax(0,760px)_320px]">
      <section className="rounded-card border border-brand-lavender bg-white p-6 shadow-card">
        <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-brand-primary">
          Operação da sessão
        </p>
        <h1 className="mt-2 font-display text-4xl font-light italic text-brand-deep">
          {booking.serviceTitle}
        </h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
          {presentation.description}
        </p>

        <dl className="mt-6 grid gap-4 rounded-lg bg-surface-soft p-5 text-sm font-semibold text-tesText-secondary sm:grid-cols-2">
          <div>
            <dt className="font-extrabold text-brand-deep">Paciente</dt>
            <dd>{booking.patientName}</dd>
          </div>
          <div>
            <dt className="font-extrabold text-brand-deep">Horário</dt>
            <dd>{formatSessionDateTime(booking.startsAt, booking.timezone)}</dd>
          </div>
          <div>
            <dt className="font-extrabold text-brand-deep">Pagamento</dt>
            <dd>{formatFinancialStatus(booking.financialStatus)}</dd>
          </div>
          <div>
            <dt className="font-extrabold text-brand-deep">
              Estado operacional
            </dt>
            <dd>{presentation.label}</dd>
          </div>
          <div>
            <dt className="font-extrabold text-brand-deep">Valor reservado</dt>
            <dd>{formatSessionMoney(booking.priceCents, booking.currency)}</dd>
          </div>
          <div>
            <dt className="font-extrabold text-brand-deep">Sala online</dt>
            <dd>{getZoomAccessLabel(booking.zoomAccess)}</dd>
          </div>
        </dl>

        <Link
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-6 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={
            routes.therapist.sessionVideo(booking.bookingId) as Route<string>
          }
        >
          <Video aria-hidden="true" size={20} />
          Abrir sala da sessão
        </Link>

        <div className="mt-6">
          <SessionOperationActions
            actorRole="therapist"
            bookingId={booking.bookingId}
            bookingVersion={booking.bookingVersion}
            canCancel={presentation.actions.canCancel}
            canRequestReschedule={presentation.actions.canReschedule}
            cancelDisabledReason={
              presentation.actions.canCancel
                ? null
                : "Esta sessão não está elegível para cancelamento operacional."
            }
            cancellationImpactLabel="A política operacional será aplicada pelo backend antes de alterar agenda, pagamento ou repasse."
            reschedule={pendingReschedule}
            rescheduleDisabledReason={
              presentation.actions.canReschedule
                ? null
                : "Esta sessão não está elegível para reagendamento operacional."
            }
          />
        </div>
      </section>

      <aside className="rounded-card border border-brand-lavender bg-white p-6 shadow-card xl:sticky xl:top-28">
        <div className="flex size-12 items-center justify-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <ShieldCheck aria-hidden="true" size={22} />
        </div>
        <h2 className="mt-4 text-lg font-extrabold text-brand-deep">
          Segurança da sala
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          O acesso é individual e confirmado novamente ao entrar na sala.
        </p>
        <p className="mt-4 flex gap-2 text-xs font-semibold leading-5 text-tesText-secondary">
          <Video aria-hidden="true" className="mt-0.5" size={16} />
          Pagamento, horário, responsável e janela de acesso precisam estar
          válidos para iniciar a sessão.
        </p>
      </aside>
    </main>
  );
}

function formatFinancialStatus(value: string | null) {
  const labels: Record<string, string> = {
    canceled: "Cancelado",
    disputed: "Em contestação",
    failed: "Falhou",
    paid: "Confirmado",
    partially_refunded: "Reembolso parcial",
    pending: "Pendente",
    processing: "Processando",
    refunded: "Reembolsado",
  };

  return value ? (labels[value] ?? "Em análise") : "Não iniciado";
}
