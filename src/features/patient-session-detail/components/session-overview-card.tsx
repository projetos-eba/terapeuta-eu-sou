import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { BookingStatus } from "@/domain/tes";
import { CalendarDays, Clock3, HeartHandshake, Star, Video } from "lucide-react";

import { TESButton } from "@/components/tes/tes-button";
import { routes } from "@/lib/routes";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";

type PrimaryAction =
  | {
      disabled?: false;
      href: string;
      label: string;
      variant?: "gradient" | "primary" | "secondary";
    }
  | {
      disabled: true;
      label: string;
      reason?: string;
    };

export function SessionOverviewCard({
  data,
}: {
  data: PatientSessionDetailPageData;
}) {
  const ratingLabel = getRatingLabel(data);
  const guidance = getGuidanceMessage(data);
  const primaryAction = getPrimaryAction(data);
  const statusTone = getStatusTone(data.booking.status, data.booking.canJoin);

  return (
    <section className="overflow-hidden rounded-card border border-border bg-white p-5 shadow-card sm:p-7">
      <div className="grid gap-7">
        <div className="min-w-0">
          <div className="flex items-start gap-4 sm:gap-5">
            <Avatar
              name={data.therapist.name}
              online={data.therapist.isOnline}
              src={data.therapist.avatarUrl}
            />
            <div className="min-w-0">
              <h2
                className="mt-2 truncate text-[1.55rem] font-extrabold leading-tight text-brand-deep sm:text-[1.75rem]"
                title={data.therapist.name}
              >
                {data.therapist.name}
              </h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
                {data.therapist.roleLabel}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="inline-flex min-h-8 items-center rounded-full bg-white/90 px-3 text-[11px] font-extrabold text-brand-primary sm:text-xs">
                  {data.service.therapyName}
                </span>
                {ratingLabel ? (
                  <span className="text-[11px] font-semibold leading-5 text-tesText-secondary sm:text-xs">
                    {ratingLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 border-t border-border pt-6">
          <dl className="grid gap-5 sm:grid-cols-3">
            <OverviewFact
              icon={CalendarDays}
              label="Data"
              value={data.booking.dateLabel}
            />
            <OverviewFact
              icon={Clock3}
              label="Horário"
              value={data.booking.timeRangeLabel}
              supporting={data.booking.durationLabel}
            />
            <OverviewFact
              icon={HeartHandshake}
              label="Terapia"
              value={data.service.title}
              supporting={data.service.therapyName}
            />
          </dl>
        </div>

        <div className="min-w-0 border-t border-border pt-6">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-tesText-muted sm:text-xs">
            Status
          </p>
          <div className="mt-3">
            <StatusPill tone={statusTone}>
              {data.booking.statusLabel}
            </StatusPill>
          </div>
          <p className="mt-4 text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
            {guidance}
          </p>

          <div className="mt-5 grid gap-4 border-t border-border pt-5">
            <StateLine
              label="Pagamento"
              supporting={data.encounterState.payment.message}
              value={data.encounterState.payment.title}
            />
            <StateLine
              label="Segurança de acesso"
              supporting={data.onlineSession.securityNote}
              value={data.onlineSession.joinRecommendation}
            />
          </div>

          {primaryAction.disabled ? (
            <button
              className="mt-5 inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-surface-soft px-6 text-sm font-extrabold text-tesText-secondary"
              disabled
              title={primaryAction.reason}
              type="button"
            >
              <Video aria-hidden="true" size={18} />
              {primaryAction.label}
            </button>
          ) : (
            <TESButton
              className="mt-5 w-full"
              href={primaryAction.href}
              size="lg"
              variant={primaryAction.variant ?? "primary"}
            >
              <Video aria-hidden="true" size={18} />
              {primaryAction.label}
            </TESButton>
          )}
          <Link
            className="mt-4 inline-flex min-h-11 items-center text-sm font-extrabold text-brand-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            href={data.therapist.profileHref as Route<string>}
          >
            Ver perfil profissional
          </Link>
          {canReviewFeedback(data.booking.status) ? (
            <Link
              className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-extrabold text-brand-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              href={`${routes.patient.encounterVideo(data.booking.id)}?feedback=1` as Route<string>}
            >
              <Star aria-hidden="true" size={17} />
              Avaliar encontro
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function OverviewFact({
  icon: Icon,
  label,
  supporting,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  supporting?: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-tesText-muted sm:text-xs">
        <Icon aria-hidden="true" className="text-brand-primary" size={16} />
        {label}
      </p>
      <p className="mt-3 text-sm font-extrabold leading-6 text-brand-deep sm:text-base">
        {value}
      </p>
      {supporting ? (
        <p className="text-[11px] font-semibold leading-5 text-tesText-secondary sm:text-xs">
          {supporting}
        </p>
      ) : null}
    </div>
  );
}

function StateLine({
  label,
  supporting,
  value,
}: {
  label: string;
  supporting: string;
  value: string;
}) {
  return (
    <div className="grid gap-1">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-tesText-muted sm:text-xs">
        {label}
      </p>
      <p className="text-sm font-extrabold leading-6 text-brand-deep sm:text-base">
        {value}
      </p>
      <p className="text-[11px] font-semibold leading-5 text-tesText-secondary sm:text-xs">
        {supporting}
      </p>
    </div>
  );
}

function StatusPill({
  children,
  tone,
}: {
  children: string;
  tone: "danger" | "neutral" | "success" | "warning";
}) {
  const toneClasses = {
    danger: "bg-status-dangerBg text-status-danger",
    neutral: "bg-white text-brand-primary",
    success: "bg-status-successBg text-status-success",
    warning: "bg-status-warningBg text-status-warning",
  }[tone];

  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full px-3 text-[11px] font-extrabold sm:text-xs ${toneClasses}`}
    >
      {children}
    </span>
  );
}

function Avatar({
  name,
  online,
  src,
}: {
  name: string;
  online: boolean;
  src: string | null;
}) {
  return (
    <div className="relative shrink-0">
      {src ? (
        <Image
          alt=""
          className="size-20 rounded-full object-cover sm:size-24"
          height={96}
          src={src}
          width={96}
        />
      ) : (
        <span className="grid size-20 place-items-center rounded-full bg-white text-2xl font-extrabold text-brand-primary sm:size-24">
          {name.charAt(0)}
        </span>
      )}
      {online ? (
        <span className="absolute bottom-1 right-1 size-4 rounded-full border-2 border-white bg-status-success sm:bottom-2 sm:right-2" />
      ) : null}
    </div>
  );
}

function getGuidanceMessage(data: PatientSessionDetailPageData) {
  if (data.encounterState.payment.kind !== "confirmed") {
    return data.encounterState.payment.message;
  }

  return data.encounterState.waitingRoom.message;
}

function getPrimaryAction(data: PatientSessionDetailPageData): PrimaryAction {
  const supportHref =
    `${routes.patient.messages}?context=suporte&booking=${data.booking.id}` as Route<string>;

  if (data.onlineSession.provider === "zoom") {
    if (
      data.encounterState.payment.kind === "confirmed" &&
      (data.encounterState.waitingRoom.kind === "entry_available" ||
        data.encounterState.waitingRoom.kind === "therapist_present")
    ) {
      return {
        href: routes.patient.encounterVideo(data.booking.id) as Route<string>,
        label: "Entrar no encontro",
        variant: "gradient",
      };
    }

    if (
      data.encounterState.payment.kind !== "confirmed" &&
      data.encounterState.payment.retryAllowed
    ) {
      return {
        href: supportHref,
        label: "Pedir ajuda com pagamento",
        variant: "secondary",
      };
    }

    if (
      data.encounterState.waitingRoom.kind === "therapist_absent_prolonged" ||
      data.encounterState.waitingRoom.kind === "operational_unavailable"
    ) {
      return {
        href: supportHref,
        label: "Falar com suporte",
        variant: "secondary",
      };
    }

    return {
      disabled: true,
      label: data.encounterState.waitingRoom.title,
      reason: getGuidanceMessage(data),
    };
  }

  if (data.booking.canJoin && data.onlineSession.meetingUrl) {
    return {
      href: data.onlineSession.meetingUrl,
      label: "Abrir videochamada",
      variant: "gradient",
    };
  }

  return {
    href: supportHref,
    label: "Falar com suporte",
    variant: "secondary",
  };
}

function canReviewFeedback(status: PatientSessionDetailPageData["booking"]["status"]) {
  return (
    status === BookingStatus.Completed ||
    status === BookingStatus.CancelledByPatient ||
    status === BookingStatus.CancelledByTherapist ||
    status === BookingStatus.NoShowPatient ||
    status === BookingStatus.NoShowTherapist ||
    status === BookingStatus.Refunded
  );
}

function getStatusTone(
  status: PatientSessionDetailPageData["booking"]["status"],
  canJoin: boolean,
) {
  if (canJoin || status === "live") return "success";
  if (status === "pending_payment") return "warning";
  if (
    status === "cancelled_by_patient" ||
    status === "cancelled_by_therapist" ||
    status === "no_show_patient" ||
    status === "no_show_therapist" ||
    status === "refunded"
  ) {
    return "danger";
  }

  return "neutral";
}

function getRatingLabel(data: PatientSessionDetailPageData) {
  if (
    data.therapist.ratingAverage === null ||
    data.therapist.reviewsCount <= 0
  ) {
    return null;
  }

  return `${data.therapist.ratingAverage.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })} · ${data.therapist.reviewsCount} avaliações`;
}
