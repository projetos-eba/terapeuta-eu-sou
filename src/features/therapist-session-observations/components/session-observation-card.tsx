"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { TESButton } from "@/components/tes";
import type {
  SessionObservation,
  SessionObservationAccess,
} from "@/features/therapist-session-observations/session-observation.types";

type SessionObservationCardProps = {
  bookingId: string;
  initialAccess: SessionObservationAccess;
};

export function SessionObservationCard({
  bookingId,
  initialAccess,
}: SessionObservationCardProps) {
  const fieldId = useId();
  const [access, setAccess] = useState(initialAccess);
  const [content, setContent] = useState(initialAccess.observation?.content ?? "");
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const changedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadObservation() {
      try {
        const response = await fetch(
          `/api/therapist/session-observations?bookingId=${encodeURIComponent(bookingId)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json().catch(() => null)) as {
          data?: SessionObservationAccess;
          ok?: boolean;
        } | null;
        if (!response.ok || !payload?.ok || !isAccess(payload.data)) {
          throw new Error("observation_unavailable");
        }
        if (cancelled) return;

        setAccess(payload.data);
        if (!changedRef.current) setContent(payload.data.observation?.content ?? "");
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage("Não foi possível consultar as observações agora.");
        }
      }
    }

    void loadObservation();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const trimmedContent = content.trim();
  const canSave = access.canEdit &&
    status !== "saving" &&
    trimmedContent.length > 0 &&
    trimmedContent.length <= 4000 &&
    trimmedContent !== (access.observation?.content ?? "");

  async function saveObservation() {
    if (!canSave) return;

    setStatus("saving");
    setErrorMessage(null);
    requestIdRef.current ??= crypto.randomUUID();

    try {
      const response = await fetch("/api/therapist/session-observations", {
        body: JSON.stringify({
          bookingId,
          content: trimmedContent,
          requestId: requestIdRef.current,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: { observation?: SessionObservation };
        error?: { message?: string };
        ok?: boolean;
      } | null;
      const observation = payload?.data?.observation;
      if (!response.ok || !payload?.ok || !isObservation(observation)) {
        throw new Error(payload?.error?.message ?? "observation_save_failed");
      }

      setAccess((current) => ({ ...current, observation }));
      setContent(observation.content);
      changedRef.current = false;
      requestIdRef.current = null;
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error && error.message !== "observation_save_failed"
          ? error.message
          : "Não foi possível salvar as observações agora. O texto foi mantido para você tentar novamente.",
      );
    }
  }

  if (!access.observation && !access.canEdit && status === "ready") return null;

  return (
    <section className="rounded-card border border-brand-lavender bg-white p-5 shadow-card sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[2rem] font-light italic leading-none text-brand-deep sm:text-[2.3rem]">
            Observações da sessão
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
            Este registro fica disponível apenas para você.
          </p>
        </div>
        {access.observation ? (
          <span className="flex items-center gap-1.5 text-xs font-extrabold text-status-success">
            <CheckCircle2 aria-hidden="true" className="size-4" />
            Salvo
          </span>
        ) : null}
      </div>

      {status === "loading" && !access.observation ? (
        <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-tesText-secondary">
          <Loader2 aria-hidden="true" className="size-4 animate-spin text-brand-primary" />
          Preparando observações…
        </p>
      ) : null}

      {status === "error" ? (
        <p className="mt-5 rounded-xl bg-status-dangerBg px-4 py-3 text-sm font-semibold leading-6 text-status-danger">
          {errorMessage}
        </p>
      ) : null}

      {access.canEdit ? (
        <div className="mt-5 grid gap-3">
          <label className="grid gap-2 text-sm font-extrabold text-brand-deep" htmlFor={fieldId}>
            Suas observações
            <textarea
              className="min-h-32 resize-y rounded-2xl border border-brand-lavender bg-white px-4 py-3 text-sm font-semibold leading-6 text-tesText-primary outline-none placeholder:text-tesText-muted focus-visible:ring-4 focus-visible:ring-ring/20"
              id={fieldId}
              maxLength={4000}
              onChange={(event) => {
                changedRef.current = true;
                setContent(event.target.value);
              }}
              placeholder="Escreva suas observações sobre esta sessão."
              value={content}
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold text-tesText-muted">
              {content.length}/4.000 caracteres
            </span>
            <TESButton disabled={!canSave} onClick={saveObservation} type="button">
              {status === "saving" ? "Salvando…" : access.observation ? "Salvar alterações" : "Salvar observações"}
            </TESButton>
          </div>
        </div>
      ) : access.observation ? (
        <div className="mt-5 grid gap-3">
          <p className="whitespace-pre-wrap rounded-2xl bg-surface-soft px-4 py-4 text-sm font-semibold leading-6 text-tesText-primary sm:text-base">
            {access.observation.content}
          </p>
          <p className="text-xs font-semibold text-tesText-muted">
            Última atualização em {formatUpdatedAt(access.observation.updatedAt)}.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data indisponível";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isAccess(value: unknown): value is SessionObservationAccess {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { canEdit?: unknown; observation?: unknown };
  return typeof candidate.canEdit === "boolean" &&
    (candidate.observation === null || isObservation(candidate.observation));
}

function isObservation(value: unknown): value is SessionObservation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SessionObservation>;
  return typeof candidate.bookingId === "string" &&
    typeof candidate.content === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string";
}
