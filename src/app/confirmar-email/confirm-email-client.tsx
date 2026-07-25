"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Loader2,
  Mail,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import { TESButton } from "@/components/tes";
import { routes } from "@/lib/routes";

type VerifyResponse =
  | { ok: true; redirectTo?: string }
  | { ok: false; message: string };

type StatusResponse =
  | { ok: true; confirmed: boolean; destination: string | null }
  | { ok: false; message: string };

type Mode = "checking" | "pending" | "success" | "error";

const BASE_POLLING_INTERVAL_MS = 5_000;
const MAX_POLLING_INTERVAL_MS = 30_000;
const RESEND_COOLDOWN_SECONDS = 60;

export function ConfirmEmailClient({
  statusToken,
  token,
}: {
  statusToken: string;
  token: string;
}) {
  const [mode, setMode] = useState<Mode>(statusToken ? "pending" : "checking");
  const [message, setMessage] = useState(
    statusToken
      ? "Enviamos um link de confirmacao. Quando voce confirmar, esta pagina avanca sozinha."
      : "Confirmando seu e-mail...",
  );
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(
    statusToken ? RESEND_COOLDOWN_SECONDS : 0,
  );
  const redirectedRef = useRef(false);
  const verifyStartedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function verify() {
      if (statusToken) return;
      if (verifyStartedTokenRef.current === token) return;
      verifyStartedTokenRef.current = token;

      if (!token) {
        setMode("error");
        setMessage("Link invalido ou expirado.");
        return;
      }

      try {
        const data = await verifyEmailWithRetry(token, controller.signal);

        if (!active) return;

        if (!data.ok) {
          setMode("error");
          setMessage(data.message);
          return;
        }

        const destination = safeInternalDestination(
          data.redirectTo,
          routes.public.clientSignIn,
        );

        setMode("success");
        setMessage("E-mail confirmado com seguranca.");
        setRedirectTo(destination);

        window.setTimeout(() => {
          window.location.assign(destination);
        }, 1600);
      } catch {
        if (!active) return;
        setMode("error");
        setMessage("Nao foi possivel confirmar o e-mail agora.");
      }
    }

    void verify();

    return () => {
      active = false;
      controller.abort();
      if (verifyStartedTokenRef.current === token && !redirectedRef.current) {
        verifyStartedTokenRef.current = null;
      }
    };
  }, [statusToken, token]);

  useEffect(() => {
    if (!statusToken || mode === "success" || mode === "error") return;

    let active = true;
    let timeoutId: number | null = null;
    let inFlight = false;
    let failureCount = 0;

    async function checkStatus() {
      if (!active || redirectedRef.current || inFlight) return;

      if (document.visibilityState === "hidden") {
        scheduleNext(BASE_POLLING_INTERVAL_MS);
        return;
      }

      inFlight = true;

      try {
        const response = await fetch("/api/auth/email/status", {
          body: JSON.stringify({ statusToken }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const data = (await response.json()) as StatusResponse;

        if (!active) return;

        if (!data.ok) {
          failureCount += 1;
          scheduleNext(backoffMs(failureCount));
          return;
        }

        failureCount = 0;

        if (!data.confirmed || !data.destination) {
          setMode("pending");
          scheduleNext(BASE_POLLING_INTERVAL_MS);
          return;
        }

        const destination = safeInternalDestination(
          data.destination,
          routes.public.clientSignIn,
        );

        redirectedRef.current = true;
        setMode("success");
        setMessage("E-mail confirmado. Voce ja pode entrar com sua senha.");
        setRedirectTo(destination);
        window.location.assign(destination);
      } catch {
        if (!active) return;
        failureCount += 1;
        scheduleNext(backoffMs(failureCount));
      } finally {
        inFlight = false;
      }
    }

    function scheduleNext(delayMs: number) {
      if (!active || redirectedRef.current) return;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        void checkStatus();
      }, delayMs);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void checkStatus();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    void checkStatus();

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [mode, statusToken]);

  useEffect(() => {
    if (cooldown <= 0 || mode === "success") return;

    const timeout = window.setTimeout(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [cooldown, mode]);

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cooldown > 0 || isResending || mode === "success") return;

    setIsResending(true);
    setResendMessage(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");

    try {
      const response = await fetch("/api/auth/email/resend", {
        body: JSON.stringify(statusToken ? { statusToken } : { email }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as { message?: string };
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setResendMessage(
        data.message ??
          "Se houver uma conta pendente, enviaremos uma nova confirmacao.",
      );
    } catch {
      setResendMessage(
        "Nao foi possivel solicitar o reenvio agora. Tente novamente em instantes.",
      );
    } finally {
      setIsResending(false);
    }
  }

  const isPending =
    Boolean(statusToken) && mode !== "success" && mode !== "error";

  return (
    <main className="min-h-screen bg-brand-lavenderSoft px-4 py-10">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-2xl items-center">
        <div className="w-full rounded-3xl border border-border bg-white p-6 shadow-soft sm:p-10">
          <div className="mb-6 inline-flex size-12 items-center justify-center rounded-2xl bg-brand-lavenderSoft text-brand-primary">
            {mode === "success" ? (
              <CheckCircle2 className="size-6" aria-hidden="true" />
            ) : isPending ? (
              <Loader2 className="size-6 animate-spin" aria-hidden="true" />
            ) : (
              <Mail className="size-6" aria-hidden="true" />
            )}
          </div>

          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-brand-primary">
            Confirmacao de e-mail
          </p>
          <h1 className="mt-3 font-display text-4xl font-light italic leading-tight text-brand-deep sm:text-5xl">
            {mode === "success"
              ? "Tudo certo por aqui"
              : isPending
                ? "Confira sua caixa de entrada"
                : "Vamos confirmar seu acesso"}
          </h1>
          <p
            role={mode === "error" ? "alert" : "status"}
            className="mt-4 text-base font-semibold leading-7 text-tesText-secondary"
          >
            {message}
          </p>

          {isPending ? (
            <div className="mt-6 rounded-2xl border border-border bg-brand-lavenderSoft px-4 py-4 text-sm font-bold leading-6 text-tesText-secondary">
              <div className="flex gap-3">
                <ShieldCheck
                  className="mt-0.5 size-5 shrink-0 text-brand-primary"
                  aria-hidden="true"
                />
                <p>
                  A verificacao acontece em segundo plano. Mantenha esta aba
                  aberta depois de clicar no link recebido.
                </p>
              </div>
            </div>
          ) : null}

          {redirectTo ? (
            <TESButton
              href={redirectTo}
              variant="gradient"
              size="lg"
              className="mt-8 min-h-12 w-full rounded-2xl"
            >
              Ir para o login
            </TESButton>
          ) : null}

          {mode === "error" || isPending ? (
            <form onSubmit={handleResend} className="mt-8 space-y-4">
              {!statusToken ? (
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-extrabold text-brand-deep"
                  >
                    E-mail
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    className="min-h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm font-bold text-brand-deep outline-none focus:ring-4 focus:ring-ring/20"
                    placeholder="seuemail@exemplo.com"
                  />
                </div>
              ) : null}
              {resendMessage ? (
                <p className="rounded-2xl bg-brand-lavenderSoft px-4 py-3 text-sm font-bold text-tesText-secondary">
                  {resendMessage}
                </p>
              ) : null}
              <TESButton
                type="submit"
                variant="secondary"
                size="lg"
                disabled={isResending || cooldown > 0}
                className="min-h-12 w-full rounded-2xl"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                {isResending
                  ? "Enviando..."
                  : cooldown > 0
                    ? `Reenviar em ${cooldown}s`
                    : "Reenviar confirmacao"}
              </TESButton>
            </form>
          ) : null}

          <p className="mt-6 text-center text-sm font-bold text-tesText-secondary">
            <Link
              href={routes.public.clientSignIn}
              className="text-brand-primary hover:underline"
            >
              Login de cliente
            </Link>{" "}
            ou{" "}
            <Link
              href={routes.public.therapistSignIn}
              className="text-brand-primary hover:underline"
            >
              login de terapeuta
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function backoffMs(failureCount: number) {
  const delay = BASE_POLLING_INTERVAL_MS * Math.max(1, failureCount);
  return Math.min(delay, MAX_POLLING_INTERVAL_MS);
}

async function verifyEmailWithRetry(token: string, signal: AbortSignal) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("/api/auth/email/verify", {
        body: JSON.stringify({ token }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal,
      });
      const data = (await response.json()) as VerifyResponse;

      if (response.status < 500 || attempt === 3) {
        return data;
      }
    } catch (error) {
      lastError = error;

      if (attempt === 3) {
        throw error;
      }
    }

    await sleep(700 * attempt, signal);
  }

  throw lastError ?? new Error("EMAIL_VERIFY_FAILED");
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timeout = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function safeInternalDestination(
  value: string | null | undefined,
  fallback: string,
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}
