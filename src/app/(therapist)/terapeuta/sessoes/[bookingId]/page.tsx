import { notFound } from "next/navigation";
import { ShieldCheck, Video } from "lucide-react";

import { therapistRoutePolicies } from "@/features/therapist-shell";
import { ZoomMeetingAdapter } from "@/features/zoom/zoom-meeting-adapter";
import { requireTherapistSession } from "@/lib/auth/therapist-session";
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
  patient_profiles: { display_name: string | null } | null;
  therapist_services: { title: string } | null;
};

export default async function TherapistSessionDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const session = await requireTherapistSession(
    therapistRoutePolicies.sessions,
  );
  const config = getSupabaseServerRestConfig(session.accessToken);
  const [booking] = config
    ? await supabaseServerRestRequest<BookingRow[]>(
        config,
        `/rest/v1/bookings?select=id,starts_at,ends_at,timezone,status,payment_status,patient_profiles(display_name),therapist_services(title)&id=eq.${encodeURIComponent(bookingId)}&therapist_profile_id=eq.${encodeURIComponent(session.profileId)}&limit=1`,
      ).catch(() => [])
    : [];

  if (!booking) notFound();

  const canJoin =
    booking.payment_status === "paid" &&
    !["cancelled_by_patient", "cancelled_by_therapist", "refunded"].includes(
      booking.status,
    ) &&
    isWithinJoinWindow(booking.starts_at, booking.ends_at);

  return (
    <main className="grid gap-6 pb-10 text-tesText-primary xl:grid-cols-[minmax(0,760px)_320px]">
      <section className="rounded-card border border-brand-lavender bg-white p-6 shadow-card">
        <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-brand-primary">
          Sala Zoom
        </p>
        <h1 className="mt-2 font-display text-4xl font-light italic text-brand-deep">
          {booking.therapist_services?.title ?? "Detalhe da sessão"}
        </h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
          A sala é criada depois do pagamento confirmado. O acesso de anfitrião
          é liberado somente para o terapeuta responsável.
        </p>

        <div className="mt-6 grid gap-3 rounded-2xl bg-surface-soft p-5 text-sm font-semibold text-tesText-secondary sm:grid-cols-2">
          <span>
            <strong className="block text-brand-deep">Paciente</strong>
            {booking.patient_profiles?.display_name ?? "Cliente TES"}
          </span>
          <span>
            <strong className="block text-brand-deep">Horário</strong>
            {formatDateTime(booking.starts_at)}
          </span>
          <span>
            <strong className="block text-brand-deep">Pagamento</strong>
            {booking.payment_status === "paid" ? "Confirmado" : "Pendente"}
          </span>
          <span>
            <strong className="block text-brand-deep">Status</strong>
            {booking.status}
          </span>
        </div>

        <ZoomMeetingAdapter
          bookingId={booking.id}
          canJoin={canJoin}
          disabledLabel={
            booking.payment_status === "paid"
              ? "Disponível 15 min antes"
              : "Aguardando pagamento"
          }
        />
      </section>

      <aside className="rounded-card border border-brand-lavender bg-white p-6 shadow-card xl:sticky xl:top-28">
        <div className="flex size-12 items-center justify-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <ShieldCheck aria-hidden="true" size={22} />
        </div>
        <h2 className="mt-4 text-lg font-extrabold text-brand-deep">
          Segurança da sala
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          O Zoom recebe apenas os dados operacionais necessários para a
          videochamada. Gravação automática fica desativada por padrão.
        </p>
        <p className="mt-4 flex gap-2 text-xs font-semibold leading-5 text-tesText-secondary">
          <Video aria-hidden="true" className="mt-0.5" size={16} />
          Se o acesso de anfitrião não abrir, verifique a autorização do app no
          Zoom Marketplace.
        </p>
      </aside>
    </main>
  );
}

function isWithinJoinWindow(startsAt: string, endsAt: string) {
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();

  return now >= start - 15 * 60_000 && now <= end + 30 * 60_000;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
