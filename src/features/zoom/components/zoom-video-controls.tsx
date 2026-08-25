"use client";

import {
  CircleHelp,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import type { ReactNode } from "react";

import { TESButton } from "@/components/tes";

type ZoomVideoControlsProps = {
  actorRole: "patient" | "therapist";
  audioMuted: boolean;
  isBusy: boolean;
  isOnline: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onReviewPermissions: () => void;
  supportHref?: string;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onTherapistEnd: () => void;
  roleType: 0 | 1 | null;
  state:
    | "idle"
    | "loading"
    | "joining"
    | "joined"
    | "reconnecting"
    | "leaving"
    | "ended"
    | "error";
  videoOn: boolean;
};

export function ZoomVideoControls({
  actorRole,
  audioMuted,
  isBusy,
  isOnline,
  onJoin,
  onLeave,
  onReviewPermissions,
  supportHref,
  onToggleAudio,
  onToggleVideo,
  onTherapistEnd,
  roleType,
  state,
  videoOn,
}: ZoomVideoControlsProps) {
  const isLive = state === "joined" || state === "reconnecting";

  if (!isLive) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <TESButton
          className="flex-1"
          disabled={isBusy || !isOnline}
          onClick={onJoin}
          size="lg"
          type="button"
          variant="gradient"
        >
          {state === "loading" || state === "joining" ? (
            <Loader2 aria-hidden="true" className="animate-spin" size={20} />
          ) : (
            <Video aria-hidden="true" size={20} />
          )}
          {state === "joining"
            ? "Entrando…"
            : actorRole === "patient"
              ? "Entrar no encontro"
              : "Entrar na sessão"}
        </TESButton>
        <TESButton
          className="flex-1"
          disabled={isBusy || !isOnline}
          onClick={onReviewPermissions}
          size="lg"
          type="button"
          variant="secondary"
        >
          <Mic aria-hidden="true" size={18} />
          Testar câmera e microfone
        </TESButton>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-[24px] border border-brand-lavender/70 bg-white/95 p-2.5 shadow-card sm:gap-3 sm:p-3">
        <ControlButton
          active={!audioMuted}
          label={audioMuted ? "Ativar microfone" : "Silenciar microfone"}
          onClick={onToggleAudio}
        >
          {audioMuted ? (
            <MicOff aria-hidden="true" size={21} />
          ) : (
            <Mic aria-hidden="true" size={21} />
          )}
        </ControlButton>
        <ControlButton
          active={videoOn}
          label={videoOn ? "Desligar câmera" : "Ativar câmera"}
          onClick={onToggleVideo}
        >
          {videoOn ? (
            <Video aria-hidden="true" size={21} />
          ) : (
            <VideoOff aria-hidden="true" size={21} />
          )}
        </ControlButton>
        {supportHref ? (
          <a
            className="inline-flex min-h-12 items-center gap-2 rounded-full border-l border-brand-lavender px-3 text-brand-deep transition hover:text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:px-4"
            href={supportHref}
          >
            <span className="grid size-9 place-items-center rounded-full border border-brand-lavender bg-brand-lavenderSoft text-brand-primary">
              <CircleHelp aria-hidden="true" size={19} />
            </span>
            <span className="hidden text-left text-sm font-extrabold sm:grid">
              Suporte
              <span className="text-xs font-semibold text-tesText-secondary">
                precisa de ajuda?
              </span>
            </span>
            <span className="sr-only">Falar com o suporte</span>
          </a>
        ) : null}
      </div>

      <button
        aria-label={actorRole === "patient" ? "Sair do encontro" : "Sair da sessão"}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[24px] border border-status-danger/40 bg-white px-5 text-sm font-extrabold text-status-danger shadow-card transition hover:bg-status-dangerBg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-status-danger disabled:pointer-events-none disabled:opacity-60"
        disabled={isBusy || !isOnline}
        onClick={onLeave}
        type="button"
      >
        <PhoneOff aria-hidden="true" size={19} />
        {actorRole === "patient" ? "Sair do encontro" : "Sair da sessão"}
      </button>

      {roleType === 1 ? (
        <button
          aria-label="Encerrar para todos"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[24px] bg-status-danger px-5 text-sm font-extrabold text-white shadow-card transition hover:bg-status-danger/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-status-danger disabled:pointer-events-none disabled:opacity-60"
          disabled={isBusy || !isOnline}
          onClick={onTherapistEnd}
          type="button"
        >
          <PhoneOff aria-hidden="true" size={19} />
          Encerrar para todos
        </button>
      ) : null}
    </div>
  );
}

function ControlButton({
  active = false,
  children,
  label,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className="grid min-h-12 min-w-12 place-items-center rounded-full bg-brand-lavenderSoft px-3 text-brand-primary transition hover:bg-brand-lavender focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}
