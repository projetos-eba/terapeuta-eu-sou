"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { LockKeyhole, Mail } from "lucide-react";

import { TESButton } from "@/components/tes";
import { routes } from "@/lib/routes";

import type { ClientAuthApiError } from "../errors";
import type { ClientAuthFieldErrors } from "../types";

type LoginResponse =
  | { ok: true; redirectTo: string }
  | ({ ok: false } & ClientAuthApiError);

export function ClientLoginForm({
  created,
  next,
  reset,
  verified,
}: {
  created: boolean;
  next?: string;
  reset?: boolean;
  verified?: boolean;
}) {
  const [fieldErrors, setFieldErrors] = useState<ClientAuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [lastEmail, setLastEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    setLastEmail(email);

    try {
      const response = await fetch("/api/auth/client/login", {
        body: JSON.stringify({
          email,
          next,
          password: String(form.get("password") ?? ""),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json()) as LoginResponse;

      if (!data.ok) {
        setFieldErrors(data.fieldErrors ?? {});
        setFormError(data.message);
        return;
      }

      window.location.assign(data.redirectTo);
    } catch {
      setFormError("Não foi possível conectar agora. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    setIsResending(true);
    setResendMessage(null);

    try {
      const response = await fetch("/api/auth/email/resend", {
        body: JSON.stringify({ email: lastEmail }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json()) as { message?: string };
      setResendMessage(data.message ?? "Verifique seu e-mail em instantes.");
    } catch {
      setResendMessage("Não foi possível reenviar agora. Tente novamente.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <form
      method="post"
      onSubmit={handleSubmit}
      noValidate
      className="relative space-y-5"
    >
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-brand-primary">
          Acesso cliente
        </p>
        <h1 className="mt-3 font-display text-4xl font-light italic leading-tight text-brand-deep sm:text-5xl">
          Entre na sua conta
        </h1>
        <p className="mt-3 text-base font-semibold leading-7 text-tesText-secondary">
          Continue sua jornada, acompanhe encontros e encontre caminhos no seu
          tempo.
        </p>
      </div>

      {created ? (
        <p className="rounded-2xl bg-status-successBg px-4 py-3 text-sm font-bold text-status-success">
          Conta criada. Enviamos um link para confirmar seu e-mail.
        </p>
      ) : null}

      {verified ? (
        <p className="rounded-2xl bg-status-successBg px-4 py-3 text-sm font-bold text-status-success">
          E-mail confirmado. Entre para continuar.
        </p>
      ) : null}

      {reset ? (
        <p className="rounded-2xl bg-status-successBg px-4 py-3 text-sm font-bold text-status-success">
          Senha atualizada. Entre com sua nova senha.
        </p>
      ) : null}

      {formError ? (
        <div className="space-y-3">
          <p
            role="alert"
            className="rounded-2xl bg-status-dangerBg px-4 py-3 text-sm font-bold text-status-danger"
          >
            {formError}
          </p>
          {formError === "Confirme seu e-mail antes de entrar." ? (
            <TESButton
              type="button"
              variant="secondary"
              size="sm"
              disabled={isResending || !lastEmail}
              onClick={handleResend}
              className="min-h-11 rounded-2xl"
            >
              Reenviar confirmacao
            </TESButton>
          ) : null}
          {resendMessage ? (
            <p className="text-xs font-bold text-tesText-secondary">
              {resendMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      <Field
        autoComplete="email"
        error={fieldErrors.email}
        icon={<Mail className="size-4" aria-hidden="true" />}
        label="E-mail"
        name="email"
        placeholder="seuemail@exemplo.com"
        type="email"
      />
      <Field
        autoComplete="current-password"
        error={fieldErrors.password}
        icon={<LockKeyhole className="size-4" aria-hidden="true" />}
        label="Senha"
        name="password"
        placeholder="Digite sua senha"
        type="password"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={routes.public.resetPassword as Route}
          className="text-sm font-extrabold text-brand-primary hover:underline"
        >
          Esqueci minha senha
        </Link>
      </div>

      <p className="relative z-0 text-center text-sm font-bold text-tesText-secondary">
        Ainda não tem conta?{" "}
        <Link
          href={
            next
              ? `${routes.public.clientSignUp}?next=${encodeURIComponent(next)}`
              : routes.public.clientSignUp
          }
          className="relative z-10 text-brand-primary hover:underline"
        >
          Criar cadastro inicial
        </Link>
      </p>

      <TESButton
        type="submit"
        variant="gradient"
        size="lg"
        disabled={isSubmitting}
        className="relative z-20 flex h-12 min-h-12 w-full rounded-2xl text-base"
      >
        {isSubmitting ? "Entrando..." : "Entrar"}
      </TESButton>
    </form>
  );
}

function Field({
  error,
  icon,
  label,
  name,
  type = "text",
  ...props
}: {
  autoComplete?: string;
  error?: string;
  icon?: ReactNode;
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
}) {
  const errorId = `${name}-error`;

  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-extrabold text-brand-deep"
      >
        {label}
      </label>
      <div className="flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-white px-4 shadow-card focus-within:ring-4 focus-within:ring-ring/20">
        <span className="text-tesText-muted">{icon}</span>
        <input
          {...props}
          id={name}
          name={name}
          type={type}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="min-h-12 w-full bg-transparent text-sm font-bold text-brand-deep outline-none placeholder:text-tesText-subtle"
        />
      </div>
      {error ? (
        <p id={errorId} className="mt-2 text-xs font-bold text-status-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
