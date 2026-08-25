import { ArrowLeft, LockKeyhole } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";

import type { ZoomAccessState } from "@/domain/tes";
import { BookingReference } from "@/features/bookings";

import { ZoomVideoSessionAdapter } from "../zoom-video-session-adapter";

export function ZoomVideoCallPage({
  access,
  actorRole,
  ambientAudioSrc,
  backHref,
  bookingId,
  participantLabel,
  scheduleLabel,
  scheduledEndsAt,
  scheduledStartsAt,
  sessionTitle,
  showFeedback = false,
}: {
  access: ZoomAccessState | null;
  actorRole: "patient" | "therapist";
  ambientAudioSrc?: string | null;
  backHref: string;
  bookingId: string;
  participantLabel: string;
  scheduleLabel: string;
  scheduledEndsAt: string;
  scheduledStartsAt: string;
  sessionTitle: string;
  showFeedback?: boolean;
}) {
  const audienceLabel = actorRole === "patient" ? "SEU ENCONTRO" : "SUA SESSÃO";

  return (
    <div className="min-h-screen min-h-dvh bg-surface-page text-tesText-primary">
      <header className="sticky top-0 z-sticky border-b border-brand-lavender/65 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 w-full max-w-[1664px] items-center justify-between gap-3 px-4 py-2 sm:min-h-20 sm:px-6 lg:min-h-[102px] lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <Link
              aria-label="Voltar aos detalhes"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-brand-lavender bg-white text-brand-deep transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              href={backHref as Route<string>}
            >
              <ArrowLeft aria-hidden="true" size={21} />
            </Link>
            <Image
              alt="Terapeuta Eu Sou"
              className="h-auto w-[132px] shrink-0 sm:w-[150px] lg:w-[174px]"
              height={70}
              priority
              src="/logo-oficial-terapeuta-eu-sou.png"
              width={220}
            />
            <div className="hidden min-w-0 border-l border-brand-lavender pl-5 sm:block">
              <p className="truncate text-sm font-extrabold text-brand-deep lg:text-base">
                {sessionTitle}
              </p>
              <p className="truncate text-xs font-semibold text-tesText-secondary lg:text-sm">
                {participantLabel} · {scheduleLabel}
              </p>
              <BookingReference className="max-w-[42ch]" id={bookingId} />
            </div>
          </div>

          <span className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full bg-status-successBg px-3 text-sm font-extrabold text-status-success sm:px-5">
            <LockKeyhole aria-hidden="true" size={17} />
            <span className="hidden min-[380px]:inline">Sala protegida</span>
            <span className="min-[380px]:hidden">Protegida</span>
          </span>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1664px] gap-4 px-4 py-5 sm:gap-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <div className="grid gap-1">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-primary">
            {audienceLabel}
          </p>
          <h1 className="font-display text-[2.6rem] font-light italic leading-none text-brand-deep sm:text-5xl">
            Sala de vídeo
          </h1>
        </div>

        <ZoomVideoSessionAdapter
          access={access}
          actorRole={actorRole}
          ambientAudioSrc={ambientAudioSrc}
          backHref={backHref}
          bookingId={bookingId}
          displayMode="dedicated"
          initialFeedback={showFeedback}
          participantLabel={participantLabel}
          scheduleLabel={scheduleLabel}
          scheduledEndsAt={scheduledEndsAt}
          scheduledStartsAt={scheduledStartsAt}
          sessionTitle={sessionTitle}
        />
      </main>
    </div>
  );
}
