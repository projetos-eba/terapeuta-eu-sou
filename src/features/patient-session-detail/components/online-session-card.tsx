import Link from "next/link";
import type { Route } from "next";
import {
  AlertCircle,
  CreditCard,
  ExternalLink,
  ShieldCheck,
  Video,
} from "lucide-react";

import { TESButton } from "@/components/tes/tes-button";
import { routes } from "@/lib/routes";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";
import { PreEncounterDeviceCheck } from "./pre-encounter-device-check";

export function OnlineSessionCard({
  data,
}: {
  data: PatientSessionDetailPageData;
}) {
  if (data.booking.status === "completed") {
    return (
      <section className="grid gap-3 border-t border-border pt-8">
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
    <section className="grid gap-6 border-t border-border pt-8">
      <div className="grid gap-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-primary sm:text-xs">
          Acesso online
        </p>
        <h2 className="font-display text-[2rem] font-light italic leading-none text-brand-deep sm:text-[2.3rem]">
          Como este encontro acontece
        </h2>
        <p className="max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
          O acesso ao encontro depende do estado financeiro e da janela segura
          da sala. Você não precisa copiar links técnicos nem confirmar nada por
          fora da plataforma.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StateCard
          icon={CreditCard}
          label="Pagamento"
          supporting={data.encounterState.payment.message}
          value={data.encounterState.payment.title}
        />
        <StateCard
          icon={Video}
          label="Entrada"
          supporting={data.encounterState.waitingRoom.message}
          value={data.encounterState.waitingRoom.title}
        />
      </div>

      <div className="rounded-[28px] border border-border bg-white/80 p-5 sm:p-6">
        <p className="flex gap-2 text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
          <ShieldCheck
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-brand-primary"
            size={18}
          />
          {data.onlineSession.securityNote}
        </p>

        {showPaymentSupport ? (
          <div className="mt-5 rounded-[22px] bg-status-warningBg px-4 py-4 sm:px-5">
            <p className="flex gap-2 text-sm font-semibold leading-6 text-tesText-secondary">
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-status-warning"
                size={18}
              />
              O pagamento ainda precisa ser confirmado para liberar o acesso com
              segurança.
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

        <PreEncounterDeviceCheck
          countdownLabel={data.encounterState.preparation.countdownLabel}
          enabled={data.encounterState.preparation.deviceCheckRecommended}
        />

        {showExternalEntry && data.onlineSession.meetingUrl ? (
          <div className="mt-5 border-t border-border pt-5">
            <p className="text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
              Este encontro usa uma sala externa. Abra a videochamada somente
              quando o acesso estiver liberado para você.
            </p>
            <a
              className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-primary px-6 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              href={data.onlineSession.meetingUrl}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" size={18} />
              Abrir videochamada
            </a>
          </div>
        ) : null}

        {data.onlineSession.provider === "zoom" &&
        data.encounterState.payment.kind === "confirmed" ? (
          <Link
            className="mt-5 inline-flex min-h-11 items-center text-sm font-extrabold text-brand-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            href={
              routes.patient.encounterVideo(data.booking.id) as Route<string>
            }
          >
            Ir para a sala segura quando a entrada estiver disponível
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function StateCard({
  icon: Icon,
  label,
  supporting,
  value,
}: {
  icon: typeof Video;
  label: string;
  supporting: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-border bg-white/80 p-5 sm:p-6">
      <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-tesText-muted sm:text-xs">
        <Icon aria-hidden="true" className="text-brand-primary" size={16} />
        {label}
      </p>
      <p className="mt-3 text-base font-extrabold text-brand-deep sm:text-lg">
        {value}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {supporting}
      </p>
    </div>
  );
}
