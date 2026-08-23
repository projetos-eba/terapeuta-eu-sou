"use client";

import {
  CalendarClock,
  CheckCircle2,
  Headphones,
  Loader2,
  LockKeyhole,
  Music2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Video,
  Volume2,
  VolumeX,
  Wifi,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type ZoomWaitingRoomProps = {
  actorRole: "patient" | "therapist";
  audioSrc?: string | null;
  countdownLabel?: string | null;
  isOnline: boolean;
  kind:
    | "entry_available"
    | "operational_unavailable"
    | "therapist_absent_prolonged"
    | "too_early"
    | "waiting_therapist"
    | "ended";
  message?: string | null;
  participantLabel: string;
  previewLoading: boolean;
  scheduleLabel?: string;
  sessionTitle?: string;
  onJoin: () => void;
  onRefresh: () => void;
  onReviewPermissions: () => void;
  supportHref?: string;
};

export function ZoomWaitingRoom({
  actorRole,
  audioSrc,
  countdownLabel,
  isOnline,
  kind,
  message,
  onJoin,
  onRefresh,
  onReviewPermissions,
  participantLabel,
  previewLoading,
  scheduleLabel,
  sessionTitle,
  supportHref,
}: ZoomWaitingRoomProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
    };
  }, []);

  async function toggleMusic() {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    if (audio.paused) {
      await audio.play();
      setIsMusicPlaying(true);
    } else {
      audio.pause();
      setIsMusicPlaying(false);
    }
  }

  const isEntryAvailable = kind === "entry_available";
  const isTooEarly = kind === "too_early";
  const isOperationalUnavailable = kind === "operational_unavailable";
  const isProlongedAbsence = kind === "therapist_absent_prolonged";
  const isEnded = kind === "ended";
  const heading = isTooEarly
    ? "Prepare seu encontro"
    : isEntryAvailable
      ? actorRole === "patient"
        ? "O terapeuta já está na sala"
        : "A sala está pronta para você"
      : isProlongedAbsence
        ? "Ainda não conseguimos encontrar o terapeuta"
        : isEnded
          ? "A sala foi encerrada"
          : isOperationalUnavailable
            ? "Vamos atualizar a sala"
            : "Estamos preparando o encontro";
  const description = isTooEarly
    ? "A sala de vídeo será liberada 15 minutos antes do horário marcado. Enquanto isso, você pode se preparar com tranquilidade."
    : isEntryAvailable
      ? actorRole === "patient"
        ? "Assim que você entrar, o encontro poderá começar com segurança e privacidade."
        : "Revise câmera e microfone antes de entrar no encontro."
      : isProlongedAbsence
        ? "Aguarde mais alguns instantes. Se a espera continuar, nossa equipe poderá acompanhar o que aconteceu."
        : isEnded
          ? "O período de entrada deste encontro terminou. Consulte os detalhes para acompanhar a situação."
        : isOperationalUnavailable
            ? "Não conseguimos atualizar a sala agora. Tente novamente quando sua conexão estiver estável."
            : "Você já está no lugar certo. A entrada será liberada assim que a presença do terapeuta for confirmada.";
  const visibleDescription = !isOnline
    ? "Sem conexão com a internet. Reconecte-se para atualizar a sala e entrar com segurança."
    : description;

  return (
    <section
      aria-label="Sala de espera do encontro"
      className="mx-auto grid w-full max-w-[1120px] gap-4"
    >
      <div className="overflow-hidden rounded-[28px] border border-brand-lavender/80 bg-white shadow-[0_24px_70px_rgba(44,25,95,0.12)]">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative min-h-[270px] overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.95),transparent_30%),linear-gradient(135deg,#f1ebff_0%,#ddd1fa_46%,#bba9ee_100%)] p-6 sm:min-h-[360px] sm:p-8">
            <div aria-hidden="true" className="absolute -right-12 top-12 size-48 rounded-full border border-white/60 bg-white/20 blur-[1px]" />
            <div aria-hidden="true" className="absolute -bottom-20 -left-10 size-64 rounded-full border border-white/50 bg-brand-primary/10" />
            <div className="relative flex h-full min-h-[220px] flex-col justify-between sm:min-h-[300px]">
              <div className="flex items-center gap-2 text-sm font-extrabold text-brand-deep">
                <span className="grid size-10 place-items-center rounded-full bg-white/75 text-brand-primary shadow-sm">
                  <Sparkles aria-hidden="true" size={19} />
                </span>
                <span>Um espaço preparado para você</span>
              </div>

              <div className="max-w-md">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-primary">
                  Sala protegida
                </p>
                <h2 className="mt-2 font-display text-4xl font-light italic leading-[1.05] text-brand-deep sm:text-5xl">
                  {heading}
                </h2>
                <p className="mt-4 max-w-lg text-sm font-semibold leading-6 text-brand-deep/75 sm:text-base">
                  {visibleDescription}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-brand-deep">
                <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white/80 px-3">
                  <LockKeyhole aria-hidden="true" size={15} />
                  Acesso individual
                </span>
                <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white/80 px-3">
                  <ShieldCheck aria-hidden="true" size={15} />
                  Privacidade TES
                </span>
              </div>
            </div>
          </div>

          <div className="grid content-between gap-5 bg-white p-5 sm:p-8">
            <div className="grid gap-3">
              <div className="flex items-start gap-3 rounded-2xl bg-surface-soft p-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
                  <CalendarClock aria-hidden="true" size={21} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-primary">
                    {sessionTitle || "Seu encontro"}
                  </p>
                  <p className="mt-1 truncate text-base font-extrabold text-brand-deep">
                    {participantLabel.replace(/^Com\s+/i, "")}
                  </p>
                  {scheduleLabel ? (
                    <p className="mt-1 text-sm font-semibold text-tesText-secondary">
                      {scheduleLabel}
                    </p>
                  ) : null}
                </div>
              </div>

              <div aria-live="polite" className="rounded-2xl border border-brand-lavender/70 bg-white p-4">
                <div className="flex items-center gap-3">
                  <span className={cn("grid size-10 place-items-center rounded-full", isEntryAvailable ? "bg-status-successBg text-status-success" : "bg-brand-lavenderSoft text-brand-primary")}>
                    {isEntryAvailable ? <CheckCircle2 aria-hidden="true" size={20} /> : <Wifi aria-hidden="true" size={20} />}
                  </span>
                  <div>
                    <p className="text-sm font-extrabold text-brand-deep">
                      {isEntryAvailable && isOnline ? "Entrada liberada" : countdownLabel || "Aguardando atualização"}
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-5 text-tesText-secondary">
                      {isEntryAvailable && isOnline ? "A sala está pronta para começar." : message || "Estamos conferindo a disponibilidade do encontro."}
                    </p>
                  </div>
                </div>
              </div>

              {audioSrc ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand-lavender/70 bg-surface-soft p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
                      <Music2 aria-hidden="true" size={19} />
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-brand-deep">Música ambiente</p>
                      <p className="mt-1 text-xs font-semibold text-tesText-secondary">Ouça enquanto espera, se quiser.</p>
                    </div>
                  </div>
                  <button
                    aria-label={isMusicPlaying ? "Pausar música ambiente" : "Ouvir música ambiente"}
                    className="grid min-h-11 min-w-11 place-items-center rounded-full bg-brand-primary text-white transition hover:bg-brand-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                    onClick={() => void toggleMusic()}
                    type="button"
                  >
                    {isMusicPlaying ? <VolumeX aria-hidden="true" size={19} /> : <Volume2 aria-hidden="true" size={19} />}
                  </button>
                  <audio ref={audioRef} src={audioSrc} loop preload="none" />
                </div>
              ) : null}
            </div>

            <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
              {isEntryAvailable ? (
                <button
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-70"
                  disabled={previewLoading || !isOnline}
                  onClick={onJoin}
                  type="button"
                >
                  <Video aria-hidden="true" size={19} />
                  Entrar na sala
                </button>
              ) : null}
              {isTooEarly ? (
                <span className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand-lavenderSoft px-5 text-center text-sm font-extrabold text-brand-primary">
                  <CalendarClock aria-hidden="true" size={18} />
                  Entrada liberada 15 min antes
                </span>
              ) : null}
              <button
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-brand-lavender bg-white px-5 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-70"
                disabled={previewLoading || !isOnline}
                onClick={onRefresh}
                type="button"
              >
                {previewLoading ? <Loader2 aria-hidden="true" className="animate-spin" size={18} /> : <RefreshCw aria-hidden="true" size={18} />}
                {previewLoading ? "Atualizando" : "Atualizar sala"}
              </button>
              <button
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-brand-lavender bg-white px-5 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-70"
                disabled={!isOnline}
                onClick={onReviewPermissions}
                type="button"
              >
                <ShieldCheck aria-hidden="true" size={18} />
                Testar dispositivos
              </button>
              {isProlongedAbsence && supportHref ? (
                <a
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand-lavenderSoft px-5 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavender focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                  href={supportHref}
                >
                  <Headphones aria-hidden="true" size={18} />
                  Falar com suporte
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
