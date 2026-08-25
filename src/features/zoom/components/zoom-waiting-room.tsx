"use client";

import {
  CalendarClock,
  Headphones,
  Loader2,
  LockKeyhole,
  Mic,
  Music2,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Video,
  Volume2,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { BookingReference } from "@/features/bookings";

type ZoomWaitingRoomProps = {
  actorRole: "patient" | "therapist";
  ambientAudioSrc?: string | null;
  bookingId?: string;
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
  supportHref?: string;
};

type DeviceTestState = "audio" | "camera" | "error" | "idle" | "loading";

export function ZoomWaitingRoom({
  actorRole,
  ambientAudioSrc,
  bookingId,
  countdownLabel,
  isOnline,
  kind,
  message,
  onJoin,
  onRefresh,
  participantLabel,
  previewLoading,
  scheduleLabel,
  sessionTitle,
  supportHref,
}: ZoomWaitingRoomProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cameraPreviewRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioFrameRef = useRef<number | null>(null);
  const [deviceTestState, setDeviceTestState] =
    useState<DeviceTestState>("idle");
  const [deviceMessage, setDeviceMessage] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  const audienceNoun = actorRole === "patient" ? "encontro" : "sessão";
  const isEntryAvailable = kind === "entry_available";
  const isTooEarly = kind === "too_early";
  const isOperationalUnavailable = kind === "operational_unavailable";
  const isProlongedAbsence = kind === "therapist_absent_prolonged";
  const isEnded = kind === "ended";
  const hasCameraPreview = Boolean(cameraStreamRef.current);
  const hasAmbientAudio = Boolean(ambientAudioSrc);

  useEffect(() => {
    const ambientAudio = audioRef.current;

    return () => {
      stopCameraPreview();
      stopAudioPreview();
      ambientAudio?.pause();
    };
  }, []);

  async function startCameraPreview() {
    if (cameraStreamRef.current) {
      stopCameraPreview();
      setDeviceTestState("idle");
      setDeviceMessage("A prévia da câmera foi encerrada.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setDeviceTestState("error");
      setDeviceMessage("Seu navegador não oferece teste de câmera nesta página.");
      return;
    }

    setDeviceTestState("loading");
    setDeviceMessage("Solicitando acesso à câmera...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true,
      });

      cameraStreamRef.current = stream;
      const preview = cameraPreviewRef.current;
      if (preview) {
        preview.srcObject = stream;
        const playback = preview.play();
        if (playback) await playback.catch(() => undefined);
      }
      setDeviceTestState("camera");
      setDeviceMessage("Sua prévia de câmera está pronta.");
    } catch {
      stopCameraPreview();
      setDeviceTestState("error");
      setDeviceMessage(
        "Não conseguimos acessar sua câmera. Revise as permissões do navegador.",
      );
    }
  }

  async function startAudioPreview() {
    if (audioStreamRef.current) {
      stopAudioPreview();
      setDeviceTestState("idle");
      setDeviceMessage("O teste de áudio foi encerrado.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setDeviceTestState("error");
      setDeviceMessage("Seu navegador não oferece teste de áudio nesta página.");
      return;
    }

    setDeviceTestState("loading");
    setDeviceMessage("Solicitando acesso ao microfone...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      audioStreamRef.current = stream;
      startAudioMeter(stream);
      setDeviceTestState("audio");
      setDeviceMessage("Seu microfone está sendo testado agora.");
    } catch {
      stopAudioPreview();
      setDeviceTestState("error");
      setDeviceMessage(
        "Não conseguimos acessar seu microfone. Revise as permissões do navegador.",
      );
    }
  }

  function startAudioMeter(stream: MediaStream) {
    if (!window.AudioContext) return;

    const context = new AudioContext();
    const analyser = context.createAnalyser();
    const source = context.createMediaStreamSource(stream);
    const samples = new Uint8Array(analyser.fftSize);
    source.connect(analyser);
    audioContextRef.current = context;

    const readLevel = () => {
      analyser.getByteTimeDomainData(samples);
      const average = samples.reduce(
        (sum, value) => sum + Math.abs(value - 128),
        0,
      );
      setAudioLevel(Math.min(100, Math.round((average / samples.length) * 9)));
      audioFrameRef.current = window.requestAnimationFrame(readLevel);
    };

    readLevel();
  }

  function stopCameraPreview() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
  }

  function stopAudioPreview() {
    if (audioFrameRef.current) {
      window.cancelAnimationFrame(audioFrameRef.current);
      audioFrameRef.current = null;
    }
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    setAudioLevel(0);
  }

  async function toggleMusic() {
    const audio = audioRef.current;
    if (!audio || !ambientAudioSrc) return;

    if (audio.paused) {
      try {
        await audio.play();
        setIsMusicPlaying(true);
      } catch {
        setDeviceMessage("Não foi possível iniciar o áudio ambiente agora.");
      }
      return;
    }

    audio.pause();
    setIsMusicPlaying(false);
  }

  const statusTitle = isEntryAvailable
    ? "Entrada liberada"
    : isTooEarly
      ? "A sala será liberada em breve"
      : isEnded
        ? "Sala encerrada"
        : isProlongedAbsence
          ? "Ainda estamos aguardando"
          : isOperationalUnavailable
            ? "Vamos atualizar a sala"
            : actorRole === "patient"
              ? "Aguardando terapeuta entrar"
              : "Aguardando paciente entrar";
  const statusMessage = !isOnline
    ? "Sem conexão com a internet. Reconecte-se para atualizar a sala."
    : message ||
      (isTooEarly
        ? "O acesso à sala é liberado 15 minutos antes. A entrada na chamada será permitida no horário agendado."
        : kind === "waiting_therapist"
          ? actorRole === "patient"
            ? "Você já está no lugar certo. A entrada será liberada assim que a presença do terapeuta for confirmada."
            : "Você já está no lugar certo. A entrada será liberada assim que a presença da pessoa atendida for confirmada."
          : "Estamos confirmando a disponibilidade da sala.");

  return (
    <section
      aria-label={`Sala de espera do ${audienceNoun}`}
      className="mx-auto grid w-full max-w-[1536px] gap-4 lg:gap-5"
    >
      <div className="grid overflow-hidden rounded-[28px] border border-brand-lavender/75 bg-white shadow-soft lg:grid-cols-[minmax(0,1.02fr)_minmax(520px,0.98fr)]">
        <WaitingRoomVisual
          deviceMessage={deviceMessage}
          deviceTestState={deviceTestState}
          hasCameraPreview={hasCameraPreview}
          onTestAudio={() => void startAudioPreview()}
          onTestCamera={() => void startCameraPreview()}
          previewRef={(node) => {
            cameraPreviewRef.current = node;
          }}
        />

        <div className="grid content-between gap-5 p-5 sm:p-7 lg:p-9">
          <div className="grid gap-5">
            <div className="grid gap-3">
              <h2 className="max-w-[16ch] font-display text-[2.3rem] font-light italic leading-[1.02] text-brand-deep sm:text-5xl">
                {isTooEarly
                  ? `A sala estará pronta no horário do ${audienceNoun}`
                  : statusTitle}
              </h2>
              <p className="max-w-[62ch] text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
                {isTooEarly
                  ? "O acesso à sala é liberado 15 minutos antes. A entrada na chamada será permitida no horário agendado."
                  : statusMessage}
              </p>
            </div>

            <div className="grid gap-3 rounded-[18px] border border-brand-lavender/70 bg-surface-soft/60 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
                  <CalendarClock aria-hidden="true" size={22} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-[0.17em] text-brand-primary">
                    {actorRole === "patient" ? "ENCONTRO" : "SESSÃO"}
                  </p>
                  <p className="mt-1 truncate text-base font-extrabold text-brand-deep sm:text-lg">
                    {participantLabel.replace(/^Com\s+/i, "")}
                  </p>
                  {bookingId ? <BookingReference id={bookingId} /> : null}
                  {scheduleLabel ? (
                    <p className="mt-1 text-sm font-semibold text-tesText-secondary">
                      {scheduleLabel}
                    </p>
                  ) : null}
                </div>
              </div>
              {sessionTitle ? (
                <p className="border-t border-brand-lavender/60 pt-3 text-sm font-semibold text-tesText-secondary">
                  {sessionTitle}
                </p>
              ) : null}
            </div>

            <div className="grid gap-3" aria-live="polite">
              {isEntryAvailable ? (
                <button
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[18px] bg-brand-primary px-6 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-70"
                  disabled={previewLoading || !isOnline}
                  onClick={onJoin}
                  type="button"
                >
                  <Video aria-hidden="true" size={19} />
                  Entrar na sala
                </button>
              ) : (
                <div
                  aria-disabled="true"
                  className="grid min-h-16 place-items-center rounded-[18px] bg-brand-lavender px-5 text-center text-white/80"
                >
                  <span className="inline-flex items-center gap-2 text-base font-semibold">
                    <LockKeyhole aria-hidden="true" size={18} />
                    Entrar na sala
                  </span>
                  <span className="mt-1 text-xs font-medium text-white/80">
                    {isTooEarly
                      ? "Disponível 15 minutos antes do início"
                      : countdownLabel || "Aguardando a liberação da sala"}
                  </span>
                </div>
              )}

              <DeviceTestButtons
                className="hidden lg:grid"
                deviceTestState={deviceTestState}
                onTestAudio={() => void startAudioPreview()}
                onTestCamera={() => void startCameraPreview()}
              />
              {deviceTestState === "audio" ? (
                <AudioLevelIndicator level={audioLevel} />
              ) : null}

              <div className="flex items-center justify-between gap-3 rounded-[18px] border border-brand-lavender/70 bg-white px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
                    <Music2 aria-hidden="true" size={19} />
                  </span>
                  <div>
                    <p className="text-sm font-extrabold text-brand-deep">Áudio ambiente</p>
                    <p className="mt-0.5 text-sm font-semibold leading-5 text-tesText-secondary">
                      Música suave para um momento de calma
                    </p>
                  </div>
                </div>
                <button
                  aria-label={
                    hasAmbientAudio
                      ? isMusicPlaying
                        ? "Pausar áudio ambiente"
                        : "Ouvir áudio ambiente"
                      : "Áudio ambiente indisponível"
                  }
                  aria-pressed={isMusicPlaying}
                  className="grid min-h-12 min-w-12 shrink-0 place-items-center rounded-full border border-brand-lavender bg-brand-lavenderSoft text-brand-primary transition hover:bg-brand-lavender focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!hasAmbientAudio}
                  onClick={() => void toggleMusic()}
                  type="button"
                >
                  {isMusicPlaying ? <Pause aria-hidden="true" size={20} /> : <Play aria-hidden="true" size={20} />}
                </button>
                {ambientAudioSrc ? (
                  <audio
                    loop
                    onPause={() => setIsMusicPlaying(false)}
                    onPlay={() => setIsMusicPlaying(true)}
                    preload="metadata"
                    ref={audioRef}
                    src={ambientAudioSrc}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-lavender/70 pt-4">
            <p className="flex max-w-[48ch] items-start gap-2 text-sm font-semibold leading-6 text-tesText-secondary">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-brand-primary"
                size={18}
              />
              A sala ficará disponível para entrada no horário agendado.
            </p>
            <div className="flex items-center gap-2">
              <button
                aria-label={previewLoading ? "Atualizando sala" : "Atualizar sala"}
                className="grid min-h-11 min-w-11 place-items-center rounded-full border border-brand-lavender bg-white text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-70"
                disabled={previewLoading || !isOnline}
                onClick={onRefresh}
                type="button"
              >
                {previewLoading ? <Loader2 aria-hidden="true" className="animate-spin" size={18} /> : <RefreshCw aria-hidden="true" size={18} />}
              </button>
              {isProlongedAbsence && supportHref ? (
                <a
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                  href={supportHref}
                >
                  <Headphones aria-hidden="true" size={18} />
                  Suporte
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <p className="sr-only" role="status">
        {deviceMessage}
      </p>
    </section>
  );
}

function WaitingRoomVisual({
  deviceMessage,
  deviceTestState,
  hasCameraPreview,
  onTestAudio,
  onTestCamera,
  previewRef,
}: {
  deviceMessage: string | null;
  deviceTestState: DeviceTestState;
  hasCameraPreview: boolean;
  onTestAudio: () => void;
  onTestCamera: () => void;
  previewRef: (node: HTMLVideoElement | null) => void;
}) {
  return (
    <div className="relative isolate min-h-[330px] overflow-hidden bg-brand-lavenderSoft sm:min-h-[430px] lg:min-h-full">
      <Image
        alt=""
        className={cn(
          "object-cover transition-opacity duration-300",
          hasCameraPreview && "opacity-0",
        )}
        fill
        priority
        sizes="(min-width: 1024px) 52vw, 100vw"
        src="/zoom/waiting-room-cover.png"
      />
      <video
        aria-label="Prévia da câmera"
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
          hasCameraPreview ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        data-testid="waiting-room-camera-preview"
        muted
        playsInline
        ref={previewRef}
      />
      <div className="absolute inset-0 bg-brand-deep/[0.03]" />
      <div className="relative flex min-h-[330px] flex-col justify-between p-5 sm:min-h-[430px] sm:p-8 lg:min-h-full lg:p-9">
        <span className="inline-flex w-fit min-h-11 items-center gap-2 rounded-full bg-white/80 px-4 text-sm font-extrabold text-brand-primary shadow-sm backdrop-blur">
          <ShieldCheck aria-hidden="true" size={18} />
          Sala protegida
        </span>

        {!hasCameraPreview ? (
          <div
            className="absolute left-1/2 top-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center text-brand-primary sm:size-24"
            data-testid="waiting-room-center-mark"
          >
            <UserRound aria-hidden="true" size={44} strokeWidth={1.7} />
          </div>
        ) : (
          <span className="mx-auto rounded-full bg-brand-deep/70 px-4 py-2 text-sm font-extrabold text-white backdrop-blur">
            Prévia da câmera
          </span>
        )}

        <div className="lg:hidden">
          <DeviceTestButtons
            deviceTestState={deviceTestState}
            onTestAudio={onTestAudio}
            onTestCamera={onTestCamera}
          />
          {deviceMessage ? (
            <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-sm font-semibold text-brand-deep backdrop-blur">
              {deviceMessage}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DeviceTestButtons({
  className,
  deviceTestState,
  onTestAudio,
  onTestCamera,
}: {
  className?: string;
  deviceTestState: DeviceTestState;
  onTestAudio: () => void;
  onTestCamera: () => void;
}) {
  const isLoading = deviceTestState === "loading";

  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      <button
        aria-pressed={deviceTestState === "camera"}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[16px] border border-brand-lavender bg-white/90 px-3 text-sm font-extrabold text-brand-primary shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-70"
        disabled={isLoading}
        onClick={onTestCamera}
        type="button"
      >
        {isLoading ? <Loader2 aria-hidden="true" className="animate-spin" size={18} /> : <Video aria-hidden="true" size={18} />}
        Testar câmera
      </button>
      <button
        aria-pressed={deviceTestState === "audio"}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[16px] border border-brand-lavender bg-white/90 px-3 text-sm font-extrabold text-brand-primary shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-70"
        disabled={isLoading}
        onClick={onTestAudio}
        type="button"
      >
        <Mic aria-hidden="true" size={18} />
        Testar áudio
      </button>
    </div>
  );
}

function AudioLevelIndicator({ level }: { level: number }) {
  return (
    <div aria-label="Nível do microfone" className="flex items-center gap-3 rounded-[16px] bg-surface-soft px-4 py-3">
      <Volume2 aria-hidden="true" className="text-brand-primary" size={18} />
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-lavenderSoft">
        <div
          className="h-full rounded-full bg-brand-primary transition-[width] duration-100"
          style={{ width: `${Math.max(4, level)}%` }}
        />
      </div>
      <span className="text-sm font-extrabold text-brand-deep">Microfone ativo</span>
    </div>
  );
}
