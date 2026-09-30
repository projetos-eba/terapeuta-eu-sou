"use client";

import Link from "next/link";
import { Video } from "lucide-react";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { TESButton, TESDialog } from "@/components/tes";
import type { ZoomAccessState } from "@/domain/tes";
import {
  getTherapistDirectRoomEntryAtMs,
  getZoomServerClockOffsetMs,
  shouldConfirmTherapistEarlyRoomEntry,
} from "@/features/zoom/zoom-access-time";

const roomActionClassName =
  "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-brand-primary px-6 text-base font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary";
const MAX_BROWSER_TIMEOUT_MS = 2_147_483_647;

type TherapistEarlyRoomEntryProps = {
  access: ZoomAccessState;
  href: string;
  label: string;
  scheduleLabel: string;
};

export function TherapistEarlyRoomEntry({
  access,
  href,
  label,
  scheduleLabel,
}: TherapistEarlyRoomEntryProps) {
  const serverClockOffsetMs = useMemo(
    () => getZoomServerClockOffsetMs(access),
    [access],
  );
  const [serverNowMs, setServerNowMs] = useState(
    () => Date.now() + serverClockOffsetMs,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const directRoomEntryAtMs = useMemo(
    () => getTherapistDirectRoomEntryAtMs(access),
    [access],
  );

  const refreshServerNow = useCallback(() => {
    setServerNowMs(Date.now() + serverClockOffsetMs);
  }, [serverClockOffsetMs]);

  const confirmationRequired = shouldConfirmTherapistEarlyRoomEntry({
    access,
    serverNowMs,
  });

  useEffect(() => {
    const updateAfterVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshServerNow();
    };

    document.addEventListener("visibilitychange", updateAfterVisibilityChange);
    return () => {
      document.removeEventListener(
        "visibilitychange",
        updateAfterVisibilityChange,
      );
    };
  }, [refreshServerNow]);

  useEffect(() => {
    if (!directRoomEntryAtMs || serverNowMs >= directRoomEntryAtMs) return;

    const timeout = window.setTimeout(
      refreshServerNow,
      Math.min(directRoomEntryAtMs - serverNowMs, MAX_BROWSER_TIMEOUT_MS),
    );
    return () => window.clearTimeout(timeout);
  }, [directRoomEntryAtMs, refreshServerNow, serverNowMs]);

  useEffect(() => {
    if (!confirmationRequired) setDialogOpen(false);
  }, [confirmationRequired]);

  function handleOpenRoom(event: MouseEvent<HTMLAnchorElement>) {
    const currentServerNowMs = Date.now() + serverClockOffsetMs;
    setServerNowMs(currentServerNowMs);

    if (
      shouldConfirmTherapistEarlyRoomEntry({
        access,
        serverNowMs: currentServerNowMs,
      })
    ) {
      event.preventDefault();
      setDialogOpen(true);
    }
  }

  return (
    <>
      <Link
        className={roomActionClassName}
        href={href}
        onClick={handleOpenRoom}
      >
        <Video aria-hidden="true" className="size-5" />
        {label}
      </Link>

      {dialogOpen ? (
        <TESDialog
          description="A sala já está disponível para sua preparação e entrada antecipada."
          onClose={() => setDialogOpen(false)}
          title="Vai entrar antes do horário?"
        >
          <div className="grid gap-5">
            <div className="rounded-[22px] bg-surface-soft px-5 py-4 text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
              <p className="font-extrabold text-brand-deep">
                O horário contratado começa em {scheduleLabel}.
              </p>
              <p className="mt-1">
                O tempo anterior é adicional e não altera a duração da sessão.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <TESButton
                className="w-full sm:w-auto"
                onClick={() => setDialogOpen(false)}
                type="button"
                variant="secondary"
              >
                Aguardar o horário
              </TESButton>
              <TESButton className="w-full sm:w-auto" href={href}>
                Entrar agora
              </TESButton>
            </div>
          </div>
        </TESDialog>
      ) : null}
    </>
  );
}
