"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  Mic,
  RefreshCw,
  ShieldCheck,
  Wifi,
} from "lucide-react";

type DeviceStatus =
  | "blocked"
  | "checking"
  | "denied"
  | "idle"
  | "passed"
  | "unsupported";

type MediaDevice = {
  deviceId: string;
  kind: "audioinput" | "videoinput";
  label: string;
};

export function PreEncounterDeviceCheck({
  countdownLabel,
  enabled,
}: {
  countdownLabel: string | null;
  enabled: boolean;
}) {
  const [status, setStatus] = useState<DeviceStatus>("idle");
  const [message, setMessage] = useState(
    enabled
      ? "Você pode testar câmera e microfone antes da sala abrir."
      : "O teste completo fica disponível após confirmação do pagamento.",
  );
  const [devices, setDevices] = useState<MediaDevice[]>([]);
  const [audioDeviceId, setAudioDeviceId] = useState("");
  const [videoDeviceId, setVideoDeviceId] = useState("");

  const support = useMemo(() => getBrowserMediaSupport(), []);
  const audioDevices = devices.filter((device) => device.kind === "audioinput");
  const videoDevices = devices.filter((device) => device.kind === "videoinput");

  useEffect(() => {
    if (!enabled) {
      setStatus("blocked");
      setMessage(
        "O teste completo fica disponível após confirmação do pagamento.",
      );
      return;
    }

    if (!support.supported) {
      setStatus("unsupported");
      setMessage(support.message);
      return;
    }

    void listDevices();
  }, [enabled, support.message, support.supported]);

  async function listDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    try {
      const nextDevices = (await navigator.mediaDevices.enumerateDevices())
        .filter(isInputMediaDevice)
        .map((device, index) => ({
          deviceId: device.deviceId,
          kind: device.kind,
          label:
            device.label ||
            (device.kind === "audioinput"
              ? `Microfone ${index + 1}`
              : `Câmera ${index + 1}`),
        }));

      setDevices(nextDevices);
      setAudioDeviceId((current) => current || nextDevices[0]?.deviceId || "");
      setVideoDeviceId(
        (current) =>
          current ||
          nextDevices.find((device) => device.kind === "videoinput")
            ?.deviceId ||
          "",
      );
    } catch {
      setMessage("Não foi possível listar seus dispositivos agora.");
    }
  }

  async function runDeviceTest() {
    if (
      !enabled ||
      !support.supported ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      return;
    }

    setStatus("checking");
    setMessage("Solicitando permissão do navegador...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
        video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
      });

      stream.getTracks().forEach((track) => track.stop());
      setStatus("passed");
      setMessage(
        "Câmera e microfone responderam. Você pode entrar com segurança quando a sala abrir.",
      );
      await listDevices();
    } catch (error) {
      setStatus(isPermissionDenied(error) ? "denied" : "unsupported");
      setMessage(
        isPermissionDenied(error)
          ? "Permissão negada. Revise câmera e microfone nas configurações do navegador."
          : "Não conseguimos acessar câmera ou microfone. Verifique dispositivos e conexão.",
      );
    }
  }

  return (
    <div
      className="mt-6 rounded-[22px] border border-brand-lavender bg-surface-soft p-4 sm:p-5"
      id="device-check"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-brand-deep">
            Teste de câmera e microfone
          </p>
          {countdownLabel ? (
            <p className="mt-1 text-xs font-semibold text-tesText-secondary">
              {countdownLabel}
            </p>
          ) : null}
        </div>
        <StatusPill status={status} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <DeviceSelect
          disabled={!enabled || audioDevices.length === 0}
          icon={Mic}
          label="Microfone"
          onChange={setAudioDeviceId}
          options={audioDevices}
          value={audioDeviceId}
        />
        <DeviceSelect
          disabled={!enabled || videoDevices.length === 0}
          icon={Camera}
          label="Câmera"
          onChange={setVideoDeviceId}
          options={videoDevices}
          value={videoDeviceId}
        />
      </div>

      <p
        aria-live="polite"
        className="mt-4 flex gap-2 text-xs font-semibold leading-5 text-tesText-secondary"
      >
        {status === "passed" ? (
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-status-success"
            size={16}
          />
        ) : (
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-brand-primary"
            size={16}
          />
        )}
        {message}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-70"
          disabled={!enabled || status === "checking" || !support.supported}
          onClick={() => void runDeviceTest()}
          type="button"
        >
          {status === "checking" ? (
            <Loader2 aria-hidden="true" className="animate-spin" size={18} />
          ) : (
            <RefreshCw aria-hidden="true" size={18} />
          )}
          Testar dispositivos
        </button>
        <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-brand-lavender bg-white px-3 text-xs font-extrabold text-brand-deep">
          <ShieldCheck aria-hidden="true" size={16} />
          Permissões do navegador
        </span>
        <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-brand-lavender bg-white px-3 text-xs font-extrabold text-brand-deep">
          <Wifi aria-hidden="true" size={16} />
          Conexão estável
        </span>
      </div>
    </div>
  );
}

function DeviceSelect({
  disabled,
  icon: Icon,
  label,
  onChange,
  options,
  value,
}: {
  disabled: boolean;
  icon: typeof Mic;
  label: string;
  onChange: (value: string) => void;
  options: MediaDevice[];
  value: string;
}) {
  return (
    <label className="grid gap-2 text-xs font-extrabold text-brand-deep">
      <span className="inline-flex items-center gap-2">
        <Icon aria-hidden="true" size={16} />
        {label}
      </span>
      <select
        className="min-h-10 rounded-lg border border-brand-lavender bg-white px-3 text-sm font-semibold text-tesText-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:bg-brand-lavenderSoft"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.length === 0 ? (
          <option value="">Nenhum dispositivo listado</option>
        ) : (
          options.map((device) => (
            <option
              key={device.deviceId || device.label}
              value={device.deviceId}
            >
              {device.label}
            </option>
          ))
        )}
      </select>
    </label>
  );
}

function StatusPill({ status }: { status: DeviceStatus }) {
  const labels: Record<DeviceStatus, string> = {
    blocked: "Bloqueado",
    checking: "Testando",
    denied: "Permissão negada",
    idle: "Pronto para testar",
    passed: "Tudo certo",
    unsupported: "Indisponível",
  };

  return (
    <span className="inline-flex min-h-7 items-center rounded-full bg-brand-lavenderSoft px-3 text-xs font-extrabold text-brand-primary">
      {labels[status]}
    </span>
  );
}

function getBrowserMediaSupport() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      message: "Teste disponível no navegador.",
      supported: false,
    };
  }

  if (!window.isSecureContext) {
    return {
      message:
        "O navegador exige conexão segura para liberar câmera e microfone.",
      supported: false,
    };
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      message:
        "Seu navegador não oferece teste de câmera e microfone nesta página.",
      supported: false,
    };
  }

  return {
    message: "Você pode testar câmera e microfone antes da sala abrir.",
    supported: true,
  };
}

function isPermissionDenied(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "SecurityError")
  );
}

function isInputMediaDevice(
  device: MediaDeviceInfo,
): device is MediaDeviceInfo & { kind: "audioinput" | "videoinput" } {
  return device.kind === "audioinput" || device.kind === "videoinput";
}
