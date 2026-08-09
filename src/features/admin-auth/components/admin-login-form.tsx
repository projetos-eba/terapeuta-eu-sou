"use client";

import { LockKeyhole, Mail } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { TESButton } from "@/components/tes";

import type { AdminAuthFieldErrors } from "../types";

type LoginResponse =
  | { ok: true; redirectTo: string }
  | {
      fieldErrors?: AdminAuthFieldErrors;
      message: string;
      ok: false;
    };

export function AdminLoginForm() {
  const [fieldErrors, setFieldErrors] = useState<AdminAuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/admin/login", {
        body: JSON.stringify({
          email: String(form.get("email") ?? ""),
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
      setFormError("Nao foi possivel conectar agora. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="relative z-10 space-y-5"
      noValidate
      onSubmit={handleSubmit}
    >
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-brand-primary">
          Admin TES
        </p>
        <h1 className="mt-3 font-display text-4xl font-light italic leading-tight text-brand-deep sm:text-5xl">
          Governança do catálogo
        </h1>
        <p className="mt-3 text-base font-semibold leading-7 text-tesText-secondary">
          Acesse com uma conta administrativa para revisar terapias, publicação
          e impacto sistêmico.
        </p>
      </div>

      {formError ? (
        <p
          className="rounded-2xl bg-status-dangerBg px-4 py-3 text-sm font-bold text-status-danger"
          role="alert"
        >
          {formError}
        </p>
      ) : null}

      <Field
        autoComplete="email"
        error={fieldErrors.email}
        icon={<Mail aria-hidden="true" className="size-4" />}
        label="E-mail"
        name="email"
        placeholder="admin@terapeutaeusou.com"
        type="email"
      />
      <Field
        autoComplete="current-password"
        error={fieldErrors.password}
        icon={<LockKeyhole aria-hidden="true" className="size-4" />}
        label="Senha"
        name="password"
        placeholder="Digite sua senha"
        type="password"
      />

      <TESButton
        className="relative z-10 min-h-12 w-full rounded-2xl text-base"
        disabled={isSubmitting}
        size="lg"
        type="submit"
        variant="gradient"
      >
        {isSubmitting ? "Entrando..." : "Entrar no Admin"}
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
      <label className="block" htmlFor={name}>
        <span className="mb-2 block text-sm font-extrabold text-brand-deep">
          {label}
        </span>
        <div className="flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-white px-4 shadow-card focus-within:ring-4 focus-within:ring-ring/20">
          <span className="text-tesText-muted">{icon}</span>
          <input
            {...props}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={Boolean(error)}
            className="h-12 min-w-0 flex-1 bg-transparent text-sm font-bold text-brand-deep outline-none placeholder:text-tesText-muted"
            id={name}
            name={name}
            type={type}
          />
        </div>
      </label>
      {error ? (
        <p className="mt-2 text-xs font-bold text-status-danger" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
