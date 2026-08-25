"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import {
  dismissAuraRecommendationAction,
  type AuraDismissActionState,
} from "../therapist-aura.actions";

const initialState: AuraDismissActionState = { status: "idle" };

export function TherapistAuraDismissForm({
  periodEnd,
  periodStart,
  recommendationKey,
  recommendationTitle,
}: {
  periodEnd: string;
  periodStart: string;
  recommendationKey: string;
  recommendationTitle: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<AuraDismissActionState>(initialState);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    setIsPending(true);
    try {
      const nextState = await dismissAuraRecommendationAction(
        initialState,
        new FormData(event.currentTarget),
      );
      setState(nextState);
      if (nextState.status === "success") router.refresh();
    } catch {
      setState({
        message:
          "Não foi possível dispensar a recomendação agora. Tente novamente.",
        status: "error",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="grid justify-items-end gap-2">
      <form aria-busy={isPending} onSubmit={handleSubmit}>
        <input
          name="recommendationKey"
          type="hidden"
          value={recommendationKey}
        />
        <input name="periodStart" type="hidden" value={periodStart} />
        <input name="periodEnd" type="hidden" value={periodEnd} />
        <button
          aria-label={`Dispensar recomendação: ${recommendationTitle}`}
          aria-disabled={isPending}
          className="grid size-11 place-items-center rounded-lg text-tesText-muted transition hover:bg-brand-lavenderSoft hover:text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          <Trash2 aria-hidden="true" size={17} />
        </button>
      </form>
      {state.status === "error" ? (
        <p
          aria-live="assertive"
          className="max-w-56 text-right text-xs font-bold leading-4 text-status-danger"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p
          aria-live="polite"
          className="max-w-56 text-right text-xs font-bold leading-4 text-status-success"
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      {isPending ? (
        <span className="sr-only" role="status">
          Dispensando recomendação…
        </span>
      ) : null}
    </div>
  );
}
