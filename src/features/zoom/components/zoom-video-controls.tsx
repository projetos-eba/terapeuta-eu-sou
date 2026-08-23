"use client";

import { Headphones, Loader2, Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
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
  state: "idle" | "loading" | "joining" | "joined" | "reconnecting" | "leaving" | "ended" | "error";
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
        <TESButton className="flex-1" disabled={isBusy || !isOnline} onClick={onJoin} size="lg" type="button" variant="gradient">
          {state === "loading" || state === "joining" ? <Loader2 aria-hidden="true" className="animate-spin" size={20} /> : <Video aria-hidden="true" size={20} />}
          {state === "joining" ? "Entrando…" : actorRole === "patient" ? "Entrar no encontro" : "Entrar na sessão"}
        </TESButton>
        <TESButton className="flex-1" disabled={isBusy || !isOnline} onClick={onReviewPermissions} size="lg" type="button" variant="secondary">
          <Mic aria-hidden="true" size={18} />
          Testar câmera e microfone
        </TESButton>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-[22px] border border-brand-lavender/70 bg-white/95 p-3 shadow-card sm:gap-3 sm:p-4">
      <ControlButton active={!audioMuted} label={audioMuted ? "Ativar microfone" : "Silenciar microfone"} onClick={onToggleAudio}>
        {audioMuted ? <MicOff aria-hidden="true" size={20} /> : <Mic aria-hidden="true" size={20} />}
      </ControlButton>
      <ControlButton active={videoOn} label={videoOn ? "Desligar câmera" : "Ativar câmera"} onClick={onToggleVideo}>
        {videoOn ? <VideoOff aria-hidden="true" size={20} /> : <Video aria-hidden="true" size={20} />}
      </ControlButton>
      {supportHref ? (
        <a
          aria-label="Falar com o suporte"
          className="grid min-h-12 min-w-12 place-items-center rounded-full border border-brand-lavender bg-brand-lavenderSoft px-4 text-brand-primary transition hover:bg-brand-lavender focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={supportHref}
        >
          <Headphones aria-hidden="true" size={20} />
        </a>
      ) : null}
      <button
        aria-label="Sair da sessão"
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-status-error/40 px-5 text-sm font-extrabold text-status-error transition hover:bg-status-errorBg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-status-error disabled:pointer-events-none disabled:opacity-60"
        disabled={isBusy || !isOnline}
        onClick={onLeave}
        type="button"
      >
        <PhoneOff aria-hidden="true" size={19} />
        <span className="hidden sm:inline">Sair da sessão</span>
      </button>
      {roleType === 1 ? (
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-status-error px-5 text-sm font-extrabold text-white transition hover:bg-status-error/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-status-error disabled:pointer-events-none disabled:opacity-60"
          disabled={isBusy || !isOnline}
          onClick={onTherapistEnd}
          type="button"
        >
          <PhoneOff aria-hidden="true" size={19} />
          <span className="hidden sm:inline">Encerrar para todos</span>
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
      className="grid min-h-12 min-w-12 place-items-center rounded-full border border-brand-lavender bg-brand-lavenderSoft px-4 text-brand-primary transition hover:bg-brand-lavender focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
