import Link from "next/link";
import type { Route } from "next";
import {
  AlertCircle,
  CreditCard,
  ExternalLink,
  LockKeyhole,
  ShieldCheck,
  Video,
} from "lucide-react";

import { TESButton } from "@/components/tes/tes-button";
import { routes } from "@/lib/routes";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";

export function OnlineSessionCard({
  data,
}: {
  data: PatientSessionDetailPageData;
}) {
  if (data.booking.status === "completed") {
    return (
      <section className="grid gap-3 rounded-card border border-border bg-white p-5 shadow-card sm:p-7">
        <h2 className="font-display text-[2rem] font-light italic leading-none text-brand-deep sm:text-[2.3rem]">
          Encontro realizado
        </h2>
        <p className="max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
          Este encontro já aconteceu. Se houver resumo ou novos passos, eles
          aparecerão no seu histórico e nos fluxos autorizados da plataforma.
        </p>
      </section>
    );
  }

  const supportHref =
    `${routes.patient.messages}?context=suporte&booking=${data.booking.id}` as Route<string>;
  const showExternalEntry =
    data.onlineSession.provider !== "zoom" &&
    data.booking.canJoin &&
    Boolean(data.onlineSession.meetingUrl);
  const showPaymentSupport =
    data.encounterState.payment.kind !== "confirmed" &&
    data.encounterState.payment.retryAllowed;

  return (
    <section
      className="grid gap-6 rounded-card border border-border bg-white p-5 shadow-card sm:p-7"
      id="session-online"
    >
      <div className="grid gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
            <Video aria-hidden="true" size={21} />
          </span>
          <h2 className="font-display text-[2rem] font-light italic leading-none text-brand-deep sm:text-[2.3rem]">
            Seu encontro online
          </h2>
        </div>
        <p className="max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
          Entre na sala de videoconferência com segurança quando o acesso
          estiver liberado.
        </p>
      </div>

      <div className="grid gap-5 rounded-[24px] border border-brand-lavender p-4 sm:p-5 lg:grid-cols-2 lg:gap-0">
        <div className="grid gap-4 lg:border-r lg:border-border lg:pr-6">
          <div>
            <p className="text-base font-extrabold text-brand-deep sm:text-lg">
              Acesso ao encontro
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
              {data.encounterState.waitingRoom.message}
            </p>
          </div>

          {showExternalEntry && data.onlineSession.meetingUrl ? (
            <a
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-primary px-6 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              href={data.onlineSession.meetingUrl}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" size={18} />
              Abrir videochamada
            </a>
          ) : data.booking.canJoin ? (
            <TESButton
              href={
                routes.patient.encounterVideo(data.booking.id) as Route<string>
              }
              size="lg"
              variant="gradient"
            >
              <Video aria-hidden="true" size={19} />
              Entrar no encontro
            </TESButton>
          ) : (
            <div className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-lavenderSoft px-6 text-sm font-extrabold text-brand-primary">
              <LockKeyhole aria-hidden="true" size={18} />
              Acesso ainda não liberado
            </div>
          )}
        </div>

        <div className="grid gap-3 border-t border-border pt-5 lg:border-t-0 lg:pl-6 lg:pt-0">
          <p className="text-base font-extrabold text-brand-deep sm:text-lg">
            Preparação técnica
          </p>
          <ul className="grid gap-2">
            {data.encounterState.preparation.checklist.map((item) => (
              <li
                className="flex gap-2 text-sm font-semibold leading-6 text-tesText-secondary"
                key={item}
              >
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-1 shrink-0 text-status-success"
                  size={17}
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-[22px] bg-surface-soft p-4 sm:p-5">
        <p className="flex gap-2 text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
          <ShieldCheck
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-brand-primary"
            size={19}
          />
          {data.onlineSession.securityNote}
        </p>
        {showPaymentSupport ? (
          <div className="mt-4 rounded-[18px] bg-status-warningBg px-4 py-4">
            <p className="flex gap-2 text-sm font-semibold leading-6 text-tesText-secondary">
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-status-warning"
                size={18}
              />
              O pagamento ainda precisa ser confirmado para liberar o acesso.
            </p>
            <TESButton
              className="mt-4 w-full sm:w-auto"
              href={supportHref}
              variant="secondary"
            >
              Pedir ajuda com pagamento
            </TESButton>
          </div>
        ) : null}
      </div>

      {data.onlineSession.provider === "zoom" &&
      data.encounterState.payment.kind === "confirmed" ? (
        <Link
          className="inline-flex min-h-11 items-center text-sm font-extrabold text-brand-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={routes.patient.encounterVideo(data.booking.id) as Route<string>}
        >
          Ir para a sala segura quando a entrada estiver disponível
        </Link>
      ) : null}
    </section>
  );
}
