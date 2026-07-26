import Link from "next/link";
import type { Route } from "next";
import { AlertCircle, CalendarClock, Clock3, Construction } from "lucide-react";

import {
  formatSessionDateTime,
  mapSessionPresentation,
} from "@/features/bookings";
import { getTherapistAgendaPage } from "@/features/therapist-agenda";
import { getTherapistSchedule } from "@/features/therapist-schedule";
import { TherapistScheduleHours } from "@/features/therapist-schedule/components/therapist-schedule-hours";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import { requireTherapistSession } from "@/lib/auth/therapist-session";
import { routes } from "@/lib/routes";

type AgendaTab = "bloqueios" | "calendario" | "horarios";

export default async function TherapistAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const params = await searchParams;
  const tab = parseAgendaTab(params.aba);
  const session = await requireTherapistSession(therapistRoutePolicies.agenda);
  const referenceNow = new Date();
  const rangeStart = new Date(referenceNow);
  const rangeEnd = new Date(referenceNow);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 30);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 61);

  const [agendaResult, scheduleResult] = await Promise.all([
    getTherapistAgendaPage({
      accessToken: session.accessToken,
      profileId: session.profileId,
      rangeEnd: rangeEnd.toISOString(),
      rangeStart: rangeStart.toISOString(),
    }),
    getTherapistSchedule({
      accessToken: session.accessToken,
      profileId: session.profileId,
    }),
  ]);

  if (tab === "horarios") {
    if (scheduleResult.status === "error") {
      return (
        <AgendaFrame activeTab="horarios">
          <section
            className="mt-6 rounded-[14px] border border-status-danger/30 bg-white p-8 text-center shadow-card"
            role="alert"
          >
            <AlertCircle
              aria-hidden="true"
              className="mx-auto text-status-danger"
              size={28}
            />
            <h2 className="mt-4 font-display text-3xl font-light text-brand-deep">
              Horários temporariamente indisponíveis
            </h2>
            <p className="mt-3 text-sm font-semibold text-tesText-secondary">
              {scheduleResult.error.message}
            </p>
            <p className="mt-2 text-xs font-semibold text-tesText-muted">
              Referência: {scheduleResult.error.correlationId.slice(0, 8)}
            </p>
          </section>
        </AgendaFrame>
      );
    }

    return (
      <TherapistScheduleHours
        agenda={agendaResult.status === "success" ? agendaResult.data : null}
        initialSchedule={scheduleResult.data}
        referenceNow={referenceNow.toISOString()}
      />
    );
  }

  if (tab === "bloqueios") {
    return (
      <AgendaFrame activeTab="bloqueios">
        <section className="mt-6 rounded-[14px] border border-brand-lavender bg-white p-8 text-center shadow-card">
          <Construction
            aria-hidden="true"
            className="mx-auto text-brand-primary"
            size={28}
          />
          <h2 className="mt-4 font-display text-3xl font-light text-brand-deep">
            Bloqueios em construção
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-tesText-secondary">
            A visualização já faz parte da Agenda, mas criação, edição e
            recorrência de bloqueios serão entregues no marco A4.
          </p>
        </section>
      </AgendaFrame>
    );
  }

  return (
    <AgendaFrame activeTab="calendario">
      {agendaResult.status === "error" ? (
        <section
          className="mt-6 rounded-[14px] border border-status-danger/30 bg-white p-8 text-center shadow-card"
          role="alert"
        >
          <h2 className="font-display text-3xl font-light text-brand-deep">
            Agenda temporariamente indisponível
          </h2>
          <p className="mt-3 text-sm font-semibold text-tesText-secondary">
            {agendaResult.error.message}
          </p>
          <p className="mt-2 text-xs font-semibold text-tesText-muted">
            Referência: {agendaResult.error.correlationId.slice(0, 8)}
          </p>
        </section>
      ) : agendaResult.status === "empty" ? (
        <section className="mt-6 rounded-[14px] border border-brand-lavender bg-white p-8 text-center shadow-card">
          <CalendarClock
            aria-hidden="true"
            className="mx-auto text-brand-primary"
            size={28}
          />
          <h2 className="mt-4 font-display text-3xl font-light text-brand-deep">
            Agenda sem registros
          </h2>
          <p className="mt-3 text-sm font-semibold text-tesText-secondary">
            Ainda não há reservas, holds ou disponibilidade configurada neste
            período.
          </p>
        </section>
      ) : (
        <>
          <section
            aria-label="Resumo da agenda"
            className="mt-6 grid gap-4 sm:grid-cols-3"
          >
            <AgendaMetric
              label="Reservas no período"
              value={agendaResult.data.summary.bookings}
            />
            <AgendaMetric
              label="Holds ativos"
              value={agendaResult.data.summary.activeHolds}
            />
            <AgendaMetric
              label="Reagendamentos pendentes"
              value={agendaResult.data.summary.pendingReschedules}
            />
          </section>

          <section aria-label="Reservas da agenda" className="mt-6 grid gap-4">
            {agendaResult.data.bookings.map((booking) => {
              const presentation = mapSessionPresentation(booking);
              return (
                <Link
                  className="grid gap-3 rounded-[14px] border border-brand-lavender bg-white p-5 shadow-card transition hover:border-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  href={
                    routes.therapist.sessionDetail(booking.bookingId) as Route
                  }
                  key={booking.bookingId}
                >
                  <span>
                    <span className="block text-lg font-extrabold text-brand-deep">
                      {booking.serviceTitle}
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-tesText-secondary">
                      {booking.patientName} ·{" "}
                      {formatSessionDateTime(
                        booking.startsAt,
                        booking.timezone,
                      )}
                    </span>
                  </span>
                  <span className="inline-flex min-h-10 items-center gap-2 text-sm font-extrabold text-brand-primary">
                    <Clock3 aria-hidden="true" size={17} />
                    {presentation.label}
                  </span>
                </Link>
              );
            })}
          </section>
        </>
      )}
    </AgendaFrame>
  );
}

function AgendaFrame({
  activeTab,
  children,
}: {
  activeTab: AgendaTab;
  children: React.ReactNode;
}) {
  const tabs: Array<{ href: Route; id: AgendaTab; label: string }> = [
    {
      href: `${routes.therapist.agenda}?aba=calendario` as Route,
      id: "calendario",
      label: "Calendário",
    },
    {
      href: `${routes.therapist.agenda}?aba=horarios` as Route,
      id: "horarios",
      label: "Horários",
    },
    {
      href: `${routes.therapist.agenda}?aba=bloqueios` as Route,
      id: "bloqueios",
      label: "Bloqueios",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-[1180px] pb-12 text-tesText-primary">
      <header className="border-b border-brand-lavender pb-5">
        <h1 className="font-display text-[34px] font-light text-brand-deep sm:text-[40px]">
          Minha agenda
        </h1>
        <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          Organize seus horários e acompanhe sua disponibilidade.
        </p>
      </header>
      <nav
        aria-label="Seções da agenda"
        className="mt-5 grid grid-cols-3 border-b border-brand-lavender"
      >
        {tabs.map((tab) => (
          <Link
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={`flex min-h-12 items-center justify-center border-b-2 px-5 text-sm font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-primary ${
              activeTab === tab.id
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-tesText-secondary hover:text-brand-primary"
            }`}
            href={tab.href}
            key={tab.id}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </main>
  );
}

function AgendaMetric({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-[14px] border border-brand-lavender bg-white p-5 shadow-card">
      <p className="text-3xl font-extrabold text-brand-deep">{value}</p>
      <h2 className="mt-1 text-sm font-semibold text-tesText-secondary">
        {label}
      </h2>
    </article>
  );
}

function parseAgendaTab(value: string | undefined): AgendaTab {
  if (value === "calendario" || value === "bloqueios") return value;
  return "horarios";
}
