import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";

import { routes } from "@/lib/routes";

import type { TherapistDashboardPageData } from "../therapist-dashboard.types";

export function UpcomingSessionsCard({
  sessions,
  state = sessions.length ? "ready" : "empty",
}: {
  sessions: TherapistDashboardPageData["upcomingSessions"];
  state?: TherapistDashboardPageData["upcomingSessionsState"];
}) {
  return (
    <section className="rounded-panel border border-[var(--tes-color-border)]/70 bg-white p-5 shadow-card">
      <h2 className="text-xl font-bold text-brand-deep">Próximas sessões</h2>
      {state === "unavailable" ? (
        <p className="mt-6 rounded-xl bg-status-warningBg p-4 text-sm font-semibold leading-6 text-tesText-secondary">
          Não foi possível carregar os próximos horários agora. Tente novamente
          em alguns instantes.
        </p>
      ) : sessions.length ? (
        <ol className="mt-4 space-y-3">
          {sessions.slice(0, 4).map((session) => (
            <li key={session.bookingId}>
              <Link
                className="grid min-h-16 grid-cols-[68px_28px_minmax(0,1fr)] items-center gap-1 rounded-sm px-0 outline-none transition hover:bg-surface-soft focus-visible:ring-4 focus-visible:ring-ring/20"
                href={
                  routes.therapist.sessionDetail(
                    session.bookingId,
                  ) as Route<string>
                }
              >
                <time className="grid gap-0 text-xs font-bold leading-4 text-brand-deep">
                  <span>{formatDate(session.startsAt, session.timezone)}</span>
                  <span>{formatTime(session.startsAt, session.timezone)}</span>
                </time>
                <span className="relative grid size-7 place-items-center overflow-hidden rounded-full bg-brand-lavenderSoft text-xs font-bold text-brand-primary">
                  {session.patientAvatarUrl ? (
                    <Image
                      alt=""
                      className="object-cover"
                      fill
                      sizes="28px"
                      src={session.patientAvatarUrl}
                    />
                  ) : (
                    session.patientName.slice(0, 1)
                  )}
                </span>
                <span className="min-w-0">
                  <strong className="block truncate text-xs font-semibold text-brand-deep">
                    {session.patientName}
                  </strong>
                  <span className="mt-0.5 block truncate text-[11px] font-semibold text-tesText-muted">
                    {session.serviceTitle}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] font-semibold text-tesText-muted">
                    Sessão #{session.sessionReference}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-6 text-sm leading-6 text-tesText-secondary">
          Nenhuma sessão futura está agendada.
        </p>
      )}
      <Link
        className="mt-5 flex min-h-11 items-center justify-center text-xs font-bold text-brand-deep outline-none hover:text-brand-primary focus-visible:ring-4 focus-visible:ring-ring/20"
        href={routes.therapist.agenda as Route<string>}
      >
        Ver agenda completa →
      </Link>
    </section>
  );
}

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}
