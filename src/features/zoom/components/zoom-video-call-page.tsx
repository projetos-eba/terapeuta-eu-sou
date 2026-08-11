import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";

import type { ZoomAccessState } from "@/domain/tes";

import { ZoomVideoSessionAdapter } from "../zoom-video-session-adapter";

export function ZoomVideoCallPage({
  access,
  actorRole,
  backHref,
  bookingId,
  participantLabel,
  scheduleLabel,
  sessionTitle,
}: {
  access: ZoomAccessState | null;
  actorRole: "patient" | "therapist";
  backHref: string;
  bookingId: string;
  participantLabel: string;
  scheduleLabel: string;
  sessionTitle: string;
}) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[linear-gradient(145deg,#fdfcff_0%,#f4effb_48%,#eef8f7_100%)] text-tesText-primary">
      <div
        aria-hidden="true"
        className="absolute -left-32 top-20 size-80 rounded-full bg-brand-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -right-24 bottom-10 size-72 rounded-full bg-status-success/10 blur-3xl"
      />

      <header className="relative z-sticky border-b border-brand-lavender/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 w-full max-w-[1480px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              aria-label="Voltar aos detalhes"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-brand-lavender bg-white text-brand-deep transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              href={backHref as Route<string>}
            >
              <ArrowLeft aria-hidden="true" size={20} />
            </Link>
            <Image
              alt="Terapeuta Eu Sou"
              className="hidden h-auto w-[126px] sm:block"
              height={46}
              priority
              src="/logo-oficial-terapeuta-eu-sou.png"
              width={150}
            />
            <div className="min-w-0 border-l border-brand-lavender pl-4">
              <p className="truncate text-sm font-extrabold text-brand-deep">
                {sessionTitle}
              </p>
              <p className="truncate text-xs font-semibold text-tesText-secondary">
                {participantLabel} · {scheduleLabel}
              </p>
            </div>
          </div>

          <span className="hidden min-h-9 items-center gap-2 rounded-full bg-status-successBg px-4 text-xs font-extrabold text-status-success sm:inline-flex">
            <LockKeyhole aria-hidden="true" size={15} />
            Sala protegida
          </span>
        </div>
      </header>

      <main className="relative z-sticky mx-auto grid w-full max-w-[1480px] gap-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-primary">
              {actorRole === "patient" ? "Seu encontro" : "Sua sessão"}
            </p>
            <h1 className="mt-1 font-display text-3xl font-light italic text-brand-deep sm:text-4xl">
              Sala de vídeo
            </h1>
          </div>
          <p className="flex max-w-xl items-start gap-2 text-sm font-semibold leading-6 text-tesText-secondary">
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-brand-primary"
              size={18}
            />
            Câmera, microfone e entrada são confirmados nesta página. O acesso é
            individual e protegido durante todo o encontro.
          </p>
        </div>

        <div className="rounded-[28px] border border-brand-lavender/80 bg-white/90 p-3 shadow-[0_24px_70px_rgba(44,25,95,0.12)] backdrop-blur sm:p-5">
          <ZoomVideoSessionAdapter
            access={access}
            actorRole={actorRole}
            bookingId={bookingId}
            displayMode="dedicated"
          />
        </div>
      </main>
    </div>
  );
}
