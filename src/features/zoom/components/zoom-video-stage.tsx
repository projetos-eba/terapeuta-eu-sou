"use client";

import { MicOff, UserRound, UserRoundX } from "lucide-react";
import Image from "next/image";
import { createElement } from "react";

import { cn } from "@/lib/utils";

type ZoomVideoStageProps = {
  actorRole: "patient" | "therapist";
  audioMuted: boolean;
  localVideoRef: React.MutableRefObject<HTMLElement | null>;
  localPreviewUnavailable?: boolean;
  onRetryRemoteVideo?: () => void;
  participantLabel: string;
  remoteParticipantPresent: boolean;
  remoteVideoState: "off" | "attaching" | "on" | "error";
  remoteVideoRef: React.MutableRefObject<HTMLElement | null>;
  state:
    | "idle"
    | "loading"
    | "joining"
    | "joined"
    | "media_initializing"
    | "media_degraded"
    | "disconnected"
    | "recovering"
    | "reconnecting"
    | "leaving"
    | "ended"
    | "error"
    | "reload_required";
  videoOn: boolean;
};

export function ZoomVideoStage({
  actorRole,
  audioMuted,
  localVideoRef,
  localPreviewUnavailable = false,
  onRetryRemoteVideo,
  participantLabel,
  remoteParticipantPresent,
  remoteVideoState,
  remoteVideoRef,
  state,
  videoOn,
}: ZoomVideoStageProps) {
  const remoteLabel =
    participantLabel.replace(/^Com\s+/i, "") || "Outra pessoa";
  const isConnected = [
    "joined",
    "media_initializing",
    "media_degraded",
    "reconnecting",
  ].includes(state);

  return (
    <div
      className="relative h-[min(48dvh,500px)] min-h-[310px] overflow-hidden rounded-[24px] bg-brand-deep p-2 sm:h-[min(58dvh,560px)] sm:p-3 md:grid md:h-[min(62dvh,600px)] md:grid-cols-2 md:gap-3"
      data-testid="zoom-video-stage"
    >
      <VideoTile
        audioMuted={audioMuted}
        connectionLabel={videoOn ? "Câmera ligada" : "Câmera desligada"}
        containerRef={localVideoRef}
        dataTestId="zoom-local-video"
        isConnected={isConnected}
        kind="local"
        label="Você"
        localPreviewUnavailable={localPreviewUnavailable}
        videoOn={videoOn}
      />
      <VideoTile
        connectionLabel={
          remoteVideoState === "on"
            ? "Conectado"
            : remoteParticipantPresent
              ? "Câmera desligada"
              : "Aguardando"
        }
        containerRef={remoteVideoRef}
        dataTestId="zoom-remote-video"
        isConnected={isConnected}
        kind="remote"
        label={remoteLabel}
        onRetryRemoteVideo={onRetryRemoteVideo}
        remoteParticipantPresent={remoteParticipantPresent}
        remoteVideoState={remoteVideoState}
        waitingLabel={
          actorRole === "patient"
            ? "Aguardando terapeuta entrar"
            : "Aguardando paciente entrar"
        }
      />
    </div>
  );
}

function VideoTile({
  audioMuted = true,
  connectionLabel,
  containerRef,
  dataTestId,
  isConnected,
  kind,
  label,
  localPreviewUnavailable = false,
  onRetryRemoteVideo,
  remoteParticipantPresent = false,
  remoteVideoState = "off",
  videoOn = false,
  waitingLabel,
}: {
  audioMuted?: boolean;
  connectionLabel: string;
  containerRef: React.MutableRefObject<HTMLElement | null>;
  dataTestId: string;
  isConnected: boolean;
  kind: "local" | "remote";
  label: string;
  localPreviewUnavailable?: boolean;
  onRetryRemoteVideo?: () => void;
  remoteParticipantPresent?: boolean;
  remoteVideoState?: "off" | "attaching" | "on" | "error";
  videoOn?: boolean;
  waitingLabel?: string;
}) {
  const showsVideo =
    kind === "local"
      ? videoOn && !localPreviewUnavailable
      : remoteVideoState === "on";
  const coverSrc =
    kind === "local"
      ? "/zoom/local-camera-off-cover.png"
      : "/zoom/remote-waiting-cover.png";

  return (
    <div
      aria-label={kind === "remote" ? "Vídeo remoto" : "Seu vídeo"}
      className={cn(
        "absolute inset-2 overflow-hidden rounded-[18px] border border-white/20 bg-brand-deep shadow-card md:relative md:inset-auto",
        kind === "local"
          ? "bottom-5 left-auto right-5 top-auto z-10 h-[32%] w-[42%] md:order-1 md:z-auto md:h-auto md:w-auto"
          : "md:order-2",
      )}
      data-testid={dataTestId}
    >
      <Image
        alt=""
        className="object-cover"
        fill
        sizes="(min-width: 768px) 50vw, 100vw"
        src={coverSrc}
      />
      <div className="absolute inset-0 bg-brand-deep/10" />
      {!showsVideo ? (
        <div className="absolute inset-0 grid place-items-center p-4 text-center text-white">
          <div className="grid gap-3">
            <span className="mx-auto grid size-14 place-items-center rounded-full border border-white/45 bg-white/10 backdrop-blur md:size-20">
              {kind === "local" ? (
                <UserRoundX aria-hidden="true" size={32} strokeWidth={1.5} />
              ) : (
                <UserRound aria-hidden="true" size={32} strokeWidth={1.5} />
              )}
            </span>
            <p className="text-sm font-semibold md:text-xl">
              {kind === "local"
                ? localPreviewUnavailable
                  ? "Sua câmera está ligada"
                  : "Sua câmera está"
                : remoteVideoState === "error"
                  ? "Não foi possível exibir o vídeo"
                  : remoteParticipantPresent
                    ? "A câmera está"
                    : "Aguardando"}
            </p>
            <p className="font-display text-2xl font-light italic leading-none md:text-4xl">
              {kind === "local"
                ? localPreviewUnavailable
                  ? "sem prévia neste dispositivo"
                  : "desativada"
                : remoteVideoState === "error"
                  ? "tente novamente"
                  : remoteParticipantPresent
                    ? "desativada"
                    : waitingLabel?.replace(/^Aguardando\s+/i, "")}
            </p>
            {kind === "remote" && remoteVideoState === "error" ? (
              <button
                className="mx-auto inline-flex min-h-11 items-center justify-center rounded-full border border-white/60 bg-white/15 px-4 text-sm font-extrabold text-white backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                onClick={onRetryRemoteVideo}
                type="button"
              >
                Tentar exibir novamente
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {createElement("video-player-container", {
        "aria-hidden": !showsVideo,
        class: "absolute inset-0 block h-full w-full overflow-hidden",
        ref: containerRef,
      })}
      <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-[14px] bg-brand-deep/75 px-3 py-2 text-white backdrop-blur md:inset-x-3 md:bottom-3">
        <span className="truncate text-xs font-extrabold sm:text-sm">
          {label}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[11px] font-semibold text-white/85 sm:text-xs">
          {kind === "local" && audioMuted ? (
            <MicOff aria-label="Microfone desativado" size={15} />
          ) : (
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full",
                isConnected ? "bg-status-success" : "bg-white/50",
              )}
            />
          )}
          <span className="hidden sm:inline">{connectionLabel}</span>
        </span>
      </div>
    </div>
  );
}
