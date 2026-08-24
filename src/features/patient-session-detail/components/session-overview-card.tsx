import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import { BookingStatus } from "@/domain/tes";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Star,
  Video,
} from "lucide-react";

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
    <>
      <section className="rounded-card border border-brand-lavender bg-white p-5 shadow-card sm:p-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(14rem,0.9fr)_minmax(16rem,1.05fr)] xl:gap-0">
          <div className="min-w-0 xl:pr-7">
            <div className="flex items-center gap-4 sm:gap-5">
              <Avatar
                name={data.therapist.name}
                online={data.therapist.isOnline}
                src={data.therapist.avatarUrl}
              />
              <div className="min-w-0">
                <h2
                  className="truncate text-[1.65rem] font-extrabold leading-tight text-brand-deep sm:text-[1.9rem]"
                  title={data.therapist.name}
                >
                  {data.therapist.name}
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
                  {data.therapist.roleLabel}
                </p>
                <p className="mt-2 text-sm font-extrabold text-brand-primary">
                  {data.service.therapyName}
                  {ratingLabel ? ` · ${ratingLabel}` : null}
                </p>
                <Link
                  className="mt-2 inline-flex min-h-10 items-center gap-1 text-sm font-extrabold text-brand-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                  href={data.therapist.profileHref as Route<string>}
                >
                  Ver perfil
                  <ChevronRight aria-hidden="true" size={16} />
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-border pt-5 sm:gap-4 xl:grid-cols-1 xl:border-l xl:border-t-0 xl:px-7 xl:pt-0">
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
              icon={Video}
              label="Sala"
              supporting="Videoconferência"
              value={getRoomLabel(data)}
            />
          </div>

          <div
            className={`grid gap-4 border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-7 xl:pt-0 ${
              data.booking.status === BookingStatus.Confirmed
                ? "rounded-2xl border-status-success/25 bg-status-successBg/45 p-4 xl:ml-3 xl:border xl:pl-4"
                : ""
            }`}
          >
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-tesText-muted sm:text-xs">
                Status
              </p>
              <div className="mt-2">
                <StatusPill tone={statusTone}>
                  {data.booking.statusLabel}
                </StatusPill>
              </div>
            </div>
            <p className="text-sm font-semibold leading-6 text-tesText-secondary">
              {guidance}
            </p>
            <div className="hidden xl:block">
              <HeroAction
                action={primaryAction}
                data={data}
                showFeedback
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 xl:hidden">
        <HeroAction action={primaryAction} data={data} showFeedback={false} />
      </div>
    </>
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
      <p className="flex min-w-0 items-center gap-1 text-[13px] font-extrabold text-brand-deep sm:gap-2 sm:text-sm">
        <Icon
          aria-hidden="true"
          className="shrink-0 text-brand-primary"
          size={19}
        />
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-extrabold leading-5 text-brand-deep sm:text-base sm:leading-6">
        {value}
      </p>
      {supporting ? (
        <p className="break-words text-[13px] font-semibold leading-5 text-tesText-secondary sm:text-sm">
          {supporting}
        </p>
      ) : null}
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

function HeroAction({
  action,
  data,
  showFeedback,
}: {
  action: PrimaryAction;
  data: PatientSessionDetailPageData;
  showFeedback: boolean;
}) {
  const isJoinAction =
    !action.disabled &&
    (action.label === "Entrar no encontro" ||
      action.label === "Abrir videochamada");

  return (
    <div className="grid gap-3">
      {isJoinAction ? (
        <TESButton
          className="min-h-14 w-full text-base sm:text-lg"
          href={action.href}
          size="lg"
          variant={action.variant ?? "gradient"}
        >
          <Video aria-hidden="true" size={22} />
          Entrar no encontro
        </TESButton>
      ) : (
        <button
          className="inline-flex min-h-14 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-surface-soft px-6 text-base font-extrabold text-tesText-secondary"
          disabled
          title={action.disabled ? action.reason : undefined}
          type="button"
        >
          <Video aria-hidden="true" size={22} />
          Entrar no encontro
        </button>
      )}

      <p className="text-center text-sm font-semibold leading-6 text-tesText-secondary xl:hidden">
        {data.onlineSession.joinRecommendation}
      </p>

      {showFeedback && canReviewFeedback(data.booking.status) ? (
        <Link
          className="inline-flex min-h-11 items-center justify-center gap-2 text-sm font-extrabold text-brand-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={
            `${routes.patient.encounterVideo(data.booking.id)}?feedback=1` as Route<string>
          }
        >
          <Star aria-hidden="true" size={17} />
          Avaliar encontro
        </Link>
      ) : null}
    </div>
  );
}

function getRoomLabel(data: PatientSessionDetailPageData) {
  return data.onlineSession.provider === "zoom"
    ? "Sala segura"
    : "Sala externa";
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

function canReviewFeedback(
  status: PatientSessionDetailPageData["booking"]["status"],
) {
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
  if (canJoin || status === BookingStatus.Confirmed || status === "live") {
    return "success";
  }
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
