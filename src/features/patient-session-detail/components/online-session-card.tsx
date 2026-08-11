import Link from "next/link";
import type { Route } from "next";
import {
  AlertCircle,
  CreditCard,
  Info,
  ShieldCheck,
  Video,
} from "lucide-react";

import { routes } from "@/lib/routes";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";
import { CopyMeetingLinkButton } from "./copy-meeting-link-button";

export function OnlineSessionCard({
  data,
}: {
  data: PatientSessionDetailPageData;
}) {
  if (data.booking.status === "completed") {
    return (
      <section className="rounded-card border border-brand-lavender bg-white p-6 shadow-card">
        <h2 className="font-display text-3xl font-light italic text-brand-deep">
          Encontro realizado
        </h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
          Este encontro já aconteceu. Quando houver resumo disponível, ele
          aparecerá no seu histórico.
        </p>
      </section>
    );
  }

  const providerLabel = {
    external: "videochamada",
    google_meet: "Google Meet",
    zoom: "Zoom",
  }[data.onlineSession.provider];
  const { payment, waitingRoom } = data.encounterState;

  return (
    <section className="rounded-card border border-brand-lavender bg-white p-6 shadow-card">
      <h2 className="font-display text-3xl font-light italic text-brand-deep">
        Seu encontro online
      </h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
        A entrada acontece por uma sala autenticada, liberada perto do horário
        do encontro.
      </p>

      {data.onlineSession.provider !== "zoom" ? (
        <div className="mt-6">
          <label
            className="text-sm font-extrabold text-brand-deep"
            htmlFor="meeting-url"
          >
            Link da videochamada {providerLabel}
          </label>
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px]">
            <input
              className="min-h-12 min-w-0 rounded-lg border border-brand-lavender bg-surface-soft px-4 text-sm font-semibold text-tesText-secondary"
              id="meeting-url"
              readOnly
              value={
                data.onlineSession.meetingUrl ??
                "Link disponível após confirmação do pagamento"
              }
            />
            {data.onlineSession.meetingUrl ? (
              <CopyMeetingLinkButton
                meetingUrl={data.onlineSession.meetingUrl}
              />
            ) : (
              <button
                className="inline-flex min-h-12 cursor-not-allowed items-center justify-center rounded-lg border border-brand-lavender bg-white px-5 text-sm font-extrabold text-tesText-muted"
                disabled
                type="button"
              >
                Copiar link
              </button>
            )}
          </div>
        </div>
      ) : null}

      <p className="mt-4 flex gap-2 text-sm font-semibold leading-6 text-tesText-secondary">
        <ShieldCheck
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-brand-primary"
          size={18}
        />
        {data.onlineSession.securityNote}
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <StatePanel
          icon={CreditCard}
          message={payment.message}
          title={payment.title}
        />
        <StatePanel
          icon={Video}
          message={waitingRoom.message}
          title={waitingRoom.title}
        />
      </div>

      {payment.retryAllowed ? (
        <div className="mt-4 rounded-lg border border-brand-lavender bg-surface-soft p-4">
          <p className="flex gap-2 text-xs font-semibold leading-5 text-tesText-secondary">
            <AlertCircle
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-brand-primary"
              size={16}
            />
            Uma nova tentativa só deve ser concluída por fluxo autenticado. O
            pagamento precisa estar confirmado antes de liberar o acesso ao
            encontro.
          </p>
          <Link
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            href={
              `${routes.patient.messages}?context=suporte&booking=${data.booking.id}` as Route<string>
            }
          >
            Pedir ajuda com pagamento
          </Link>
        </div>
      ) : null}

      {data.onlineSession.provider === "zoom" &&
      data.encounterState.payment.kind === "confirmed" ? (
        <Link
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-6 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={routes.patient.encounterVideo(data.booking.id) as Route<string>}
        >
          <Video aria-hidden="true" size={20} />
          Abrir sala do encontro
        </Link>
      ) : data.onlineSession.provider === "zoom" ? (
        <button
          className="mt-6 inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-brand-lavenderSoft px-6 text-sm font-extrabold text-tesText-secondary"
          disabled
          type="button"
        >
          <Video aria-hidden="true" size={20} />
          {waitingRoom.title}
        </button>
      ) : data.booking.canJoin && data.onlineSession.meetingUrl ? (
        <Link
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-6 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={data.onlineSession.meetingUrl as Route<string>}
        >
          <Video aria-hidden="true" size={20} />
          Entrar no encontro
        </Link>
      ) : (
        <button
          className="mt-6 inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-brand-lavenderSoft px-6 text-sm font-extrabold text-tesText-secondary"
          disabled
          type="button"
        >
          <Video aria-hidden="true" size={20} />
          {waitingRoom.title}
        </button>
      )}

      <p className="mt-4 flex gap-2 text-xs font-semibold leading-5 text-tesText-secondary">
        <Info
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-brand-primary"
          size={16}
        />
        {data.onlineSession.joinRecommendation}
      </p>
    </section>
  );
}

function StatePanel({
  icon: Icon,
  message,
  title,
}: {
  icon: typeof Video;
  message: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-brand-lavender bg-surface-soft p-4">
      <p className="flex items-center gap-2 text-sm font-extrabold text-brand-deep">
        <Icon aria-hidden="true" className="text-brand-primary" size={18} />
        {title}
      </p>
      <p className="mt-2 text-xs font-semibold leading-5 text-tesText-secondary">
        {message}
      </p>
    </div>
  );
}
