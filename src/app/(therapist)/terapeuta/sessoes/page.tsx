import Link from "next/link";
import type { Route } from "next";
import { CalendarClock, ChevronRight, Video } from "lucide-react";

import {
  formatSessionDateTime,
  mapSessionPresentation,
} from "@/features/bookings";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import {
  buildNextSessionsHref,
  getTherapistSessionsPage,
  parseTherapistSessionFilters,
} from "@/features/therapist-sessions";
import { requireTherapistSession } from "@/lib/auth/therapist-session";
import { routes } from "@/lib/routes";

export default async function TherapistSessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireTherapistSession(
    therapistRoutePolicies.sessions,
  );
  const parsedFilters = parseTherapistSessionFilters(await searchParams);

  if (!parsedFilters.valid) {
    return <SessionsErrorState message={parsedFilters.message} />;
  }

  const result = await getTherapistSessionsPage({
    accessToken: session.accessToken,
    filters: parsedFilters.filters,
    profileId: session.profileId,
  });

  return (
    <main className="pb-10 text-tesText-primary">
      <section className="rounded-card border border-brand-lavender bg-white p-6 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-brand-primary">
              Acompanhamento operacional
            </p>
            <h1 className="mt-2 font-display text-4xl font-light italic text-brand-deep">
              Sessões
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary">
              Pagamento, realização e acesso à sala permanecem em ciclos
              independentes.
            </p>
          </div>
          <Link
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-5 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft"
            href={routes.therapist.agenda as Route}
          >
            <CalendarClock aria-hidden="true" size={18} />
            Ver agenda
          </Link>
        </div>
      </section>

      {result.status === "error" ? (
        <SessionsErrorState
          correlationId={result.error.correlationId}
          message={result.error.message}
        />
      ) : result.status === "empty" ? (
        <SessionsEmptyState />
      ) : (
        <>
          <section aria-label="Lista de sessões" className="mt-6 grid gap-4">
            {result.data.items.map((booking) => {
              const presentation = mapSessionPresentation(booking);

              return (
                <Link
                  className="grid gap-4 rounded-card border border-brand-lavender bg-white p-5 shadow-card transition hover:border-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  href={
                    routes.therapist.sessionDetail(booking.bookingId) as Route
                  }
                  key={booking.bookingId}
                >
                  <span className="min-w-0">
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
                    <span className="mt-3 block text-sm font-extrabold text-brand-primary">
                      {presentation.label}
                    </span>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-tesText-secondary">
                      {presentation.description}
                    </span>
                  </span>
                  <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-lavenderSoft px-4 text-sm font-extrabold text-brand-primary">
                    {presentation.actions.primary.action === "join_zoom" ? (
                      <Video aria-hidden="true" size={18} />
                    ) : (
                      <ChevronRight aria-hidden="true" size={18} />
                    )}
                    {presentation.actions.primary.label}
                  </span>
                </Link>
              );
            })}
          </section>

          {result.data.page.hasMore && result.data.page.nextCursor ? (
            <div className="mt-6 flex justify-center">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-lavender bg-white px-5 text-sm font-extrabold text-brand-primary hover:bg-brand-lavenderSoft"
                href={
                  buildNextSessionsHref(
                    parsedFilters.filters,
                    result.data.page.nextCursor,
                  ) as Route
                }
              >
                Carregar próximas
              </Link>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}

function SessionsEmptyState() {
  return (
    <section className="mt-6 rounded-card border border-brand-lavender bg-white p-8 text-center shadow-card">
      <h2 className="font-display text-3xl font-light italic text-brand-deep">
        Nenhuma sessão encontrada
      </h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
        Não há sessões para o período e os filtros informados.
      </p>
    </section>
  );
}

function SessionsErrorState({
  correlationId,
  message,
}: {
  correlationId?: string;
  message: string;
}) {
  return (
    <section
      className="mt-6 rounded-card border border-status-error/30 bg-white p-8 text-center shadow-card"
      role="alert"
    >
      <h2 className="font-display text-3xl font-light italic text-brand-deep">
        Sessões temporariamente indisponíveis
      </h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
        {message}
      </p>
      {correlationId ? (
        <p className="mt-2 text-xs font-semibold text-tesText-muted">
          Referência: {correlationId.slice(0, 8)}
        </p>
      ) : null}
    </section>
  );
}
