"use client";

import { createElement } from "react";

import { cn } from "@/lib/utils";

type ZoomVideoStageProps = {
  actorRole: "patient" | "therapist";
  localVideoRef: React.MutableRefObject<HTMLElement | null>;
  participantLabel: string;
  remoteParticipantCount: number;
  remoteVideoRef: React.MutableRefObject<HTMLElement | null>;
  state: "idle" | "loading" | "joining" | "joined" | "reconnecting" | "leaving" | "ended" | "error";
  videoOn: boolean;
};

export function ZoomVideoStage({
  actorRole,
  localVideoRef,
  participantLabel,
  remoteParticipantCount,
  remoteVideoRef,
  state,
  videoOn,
}: ZoomVideoStageProps) {
  const remoteLabel = participantLabel.replace(/^Com\s+/i, "") || "Outra pessoa";
  const isConnected = state === "joined" || state === "reconnecting";

  return (
    <div
      className="grid h-[min(66dvh,560px)] min-h-[360px] grid-rows-[minmax(0,1fr)_minmax(112px,27%)] gap-2 overflow-hidden rounded-[24px] bg-brand-deep p-2 sm:h-[min(64dvh,560px)] md:h-[min(58dvh,540px)] md:min-h-[360px] md:grid-cols-2 md:grid-rows-1 md:gap-3 md:p-3"
      data-testid="zoom-video-stage"
    >
      <VideoTile
        connectionLabel={remoteParticipantCount > 0 ? "Conectado" : "Aguardando"}
        containerRef={remoteVideoRef}
        dataTestId="zoom-remote-video"
        emptyLabel="Aguardando participante"
        isConnected={isConnected}
        label={remoteLabel}
        kind="remote"
        participantCount={remoteParticipantCount}
      />
      <VideoTile
        connectionLabel={videoOn ? "Câmera ligada" : "Câmera desligada"}
        containerRef={localVideoRef}
        dataTestId="zoom-local-video"
        emptyLabel="Sua câmera está desligada"
        isConnected={isConnected}
        label={actorRole === "patient" ? "Você" : "Você"}
        kind="local"
        participantCount={1}
        videoOn={videoOn}
      />
    </div>
  );
}

function VideoTile({
  connectionLabel,
  containerRef,
  dataTestId,
  emptyLabel,
  isConnected,
  kind,
  label,
  participantCount,
  videoOn = false,
}: {
  connectionLabel: string;
  containerRef: React.MutableRefObject<HTMLElement | null>;
  dataTestId: string;
  emptyLabel: string;
  isConnected: boolean;
  kind: "local" | "remote";
  label: string;
  participantCount: number;
  videoOn?: boolean;
}) {
  const isRemoteVideoVisible = kind === "remote" && participantCount > 0;

  return (
    <div
      aria-label={kind === "remote" ? "Vídeo remoto" : "Seu vídeo"}
      className={cn(
        "relative min-h-0 overflow-hidden rounded-[18px] border border-white/15 bg-brand-deep shadow-card",
        kind === "local" && "md:order-first",
        kind === "local" && "md:min-h-0",
      )}
      data-testid={dataTestId}
    >
      <div
        aria-hidden={kind === "local" ? videoOn : isRemoteVideoVisible}
        className="absolute inset-0 grid place-items-center px-4 text-center text-sm font-semibold text-white/75"
      >
        {emptyLabel}
      </div>
      {createElement("zoom-video-player-container", {
        "aria-hidden": kind === "local" ? !videoOn : !isRemoteVideoVisible,
        className: "absolute inset-0 block h-full w-full overflow-hidden",
        ref: containerRef,
      })}
      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-xl bg-brand-deep/80 px-3 py-2 text-white backdrop-blur-sm">
        <span className="truncate text-sm font-extrabold">{label}</span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-white/80">
          <span
            aria-hidden="true"
            className={cn("size-2 rounded-full", isConnected ? "bg-status-success" : "bg-white/50")}
          />
          {connectionLabel}
        </span>
      </div>
    </div>
  );
}
