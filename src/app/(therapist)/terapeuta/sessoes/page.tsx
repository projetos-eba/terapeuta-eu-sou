import Link from "next/link";
import type { Route } from "next";
import { CalendarClock, Video } from "lucide-react";

import { therapistRoutePolicies } from "@/features/therapist-shell";
import { requireTherapistSession } from "@/lib/auth/therapist-session";
import { routes } from "@/lib/routes";
import {
  getSupabaseServerRestConfig,
  supabaseServerRestRequest,
} from "@/lib/supabase/server-rest";

type BookingRow = {
  ends_at: string;
  id: string;
  payment_status: string;
  starts_at: string;
  status: string;
  timezone: string;
  therapist_services: { title: string } | null;
};

export default async function TherapistSessionsPage() {
  const session = await requireTherapistSession(
    therapistRoutePolicies.sessions,
  );
  const config = getSupabaseServerRestConfig(session.accessToken);
  const bookings = config
    ? await supabaseServerRestRequest<BookingRow[]>(
        config,
        `/rest/v1/bookings?select=id,starts_at,ends_at,timezone,status,payment_status,therapist_services(title)&therapist_profile_id=eq.${encodeURIComponent(session.profileId)}&order=starts_at.asc&limit=20`,
      ).catch(() => [])
    : [];

  return (
    <main className="pb-10 text-tesText-primary">
      <section className="rounded-card border border-brand-lavender bg-white p-6 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-brand-primary">
              Atendimento online
            </p>
            <h1 className="mt-2 font-display text-4xl font-light italic text-brand-deep">
              Sessões
            </h1>
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

      <section className="mt-6 grid gap-4">
        {bookings.length > 0 ? (
          bookings.map((booking) => (
            <Link
              className="grid gap-3 rounded-card border border-brand-lavender bg-white p-5 shadow-card transition hover:border-brand-primary sm:grid-cols-[1fr_auto] sm:items-center"
              href={routes.therapist.sessionDetail(booking.id) as Route}
              key={booking.id}
            >
              <span>
                <span className="block text-lg font-extrabold text-brand-deep">
                  {booking.therapist_services?.title ?? "Sessão"}
                </span>
                <span className="mt-1 block text-sm font-semibold text-tesText-secondary">
                  {formatDateTime(booking.starts_at)} - {booking.timezone}
                </span>
              </span>
              <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-lavenderSoft px-4 text-sm font-extrabold text-brand-primary">
                <Video aria-hidden="true" size={18} />
                Abrir
              </span>
            </Link>
          ))
        ) : (
          <div className="rounded-card border border-brand-lavender bg-white p-8 text-center shadow-card">
            <h2 className="font-display text-3xl font-light italic text-brand-deep">
              Nenhuma sessão encontrada
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
              Quando uma pessoa agendar com você, a sessão aparecerá aqui.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
