import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";

import { routes } from "@/lib/routes";

import type { TherapistDashboardPageData } from "../therapist-dashboard.types";

export function UpcomingSessionsCard({
  sessions,
}: {
  sessions: TherapistDashboardPageData["upcomingSessions"];
}) {
  return (
    <section className="rounded-panel border border-[var(--tes-color-border)]/70 bg-white p-5 shadow-card">
      <h2 className="text-xl font-bold text-brand-deep">Próximos encontros</h2>
      {sessions.length ? (
        <ol className="mt-4 space-y-3">
          {sessions.slice(0, 4).map((session) => (
            <li key={session.bookingId}>
              <Link
                className="grid min-h-12 grid-cols-[52px_32px_minmax(0,1fr)] items-center gap-2 rounded-sm px-1 outline-none transition hover:bg-surface-soft focus-visible:ring-4 focus-visible:ring-ring/20"
                href={
                  routes.therapist.plusSessionDetail(
                    session.bookingId,
                  ) as Route<string>
                }
              >
                <time className="text-xs font-bold text-brand-deep">
                  {formatTime(session.startsAt)}
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
                <span className="truncate text-xs font-semibold text-brand-deep">
                  {session.patientName}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-6 text-sm leading-6 text-tesText-secondary">
          Nenhum encontro futuro está agendado.
        </p>
      )}
      <Link
        className="mt-5 flex min-h-11 items-center justify-center text-xs font-bold text-brand-deep outline-none hover:text-brand-primary focus-visible:ring-4 focus-visible:ring-ring/20"
        href={routes.therapist.plusAgenda}
      >
        Ver agenda completa →
      </Link>
    </section>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
