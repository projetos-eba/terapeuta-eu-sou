"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Eye, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";

import { TESButton } from "@/components/tes";
import type { TherapistPlan } from "@/domain/tes";
import { routes } from "@/lib/routes";

import type { TherapistAuthApiError } from "../errors";
import type { TherapistAuthFieldErrors } from "../types";
import { getTherapistPlanLabel } from "../validation";

type SignupResponse =
  | { ok: true; redirectTo: string }
  | ({ ok: false } & TherapistAuthApiError);

export function TherapistSignupForm({ plan }: { plan: TherapistPlan }) {
  const [fieldErrors, setFieldErrors] = useState<TherapistAuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/therapist/signup", {
        body: JSON.stringify({
          birthDate: String(form.get("birthDate") ?? ""),
          confirmPassword: String(form.get("confirmPassword") ?? ""),
          email: String(form.get("email") ?? ""),
          fullName: String(form.get("fullName") ?? ""),
          password: String(form.get("password") ?? ""),
          phone: String(form.get("phone") ?? ""),
          plan,
          termsAccepted: form.get("termsAccepted") === "on",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json()) as SignupResponse;

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

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-brand-primary">
          Cadastro inicial
        </p>
        <h2 className="mt-3 font-display text-4xl font-light italic leading-tight text-brand-deep sm:text-5xl">
          Crie sua conta de terapeuta
        </h2>
        <p className="mt-3 text-base font-semibold leading-7 text-tesText-secondary">
          Plano pretendido:{" "}
          <strong className="text-brand-primary">
            {getTherapistPlanLabel(plan)}
          </strong>
          . Você completa perfil, documentos e dados de repasse depois.
        </p>
      </div>

      {formError ? (
        <p
          role="alert"
          className="rounded-2xl bg-status-dangerBg px-4 py-3 text-sm font-bold text-status-danger"
        >
          {formError}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          autoComplete="name"
          error={fieldErrors.fullName}
          icon={<UserRound className="size-4" aria-hidden="true" />}
          label="Nome completo"
          name="fullName"
          placeholder="Seu nome completo"
        />
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
          autoComplete="tel"
          error={fieldErrors.phone}
          icon={<Phone className="size-4" aria-hidden="true" />}
          label="Celular"
          name="phone"
          placeholder="(00) 00000-0000"
          type="tel"
        />
        <Field
          error={fieldErrors.birthDate}
          label="Data de nascimento"
          name="birthDate"
          type="date"
        />
        <Field
          autoComplete="new-password"
          error={fieldErrors.password}
          icon={<LockKeyhole className="size-4" aria-hidden="true" />}
          label="Senha"
          name="password"
          placeholder="Mínimo de 8 caracteres"
          type="password"
        />
        <Field
          autoComplete="new-password"
          error={fieldErrors.confirmPassword}
          icon={<Eye className="size-4" aria-hidden="true" />}
          label="Confirmar senha"
          name="confirmPassword"
          placeholder="Digite a senha novamente"
          type="password"
        />
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm font-semibold leading-6 text-tesText-secondary">
          <input
            name="termsAccepted"
            type="checkbox"
            className="mt-1 size-5 rounded border-border text-brand-primary focus:ring-brand-primary"
          />
          <span>
            Li e concordo com os{" "}
            <Link
              href={routes.public.terms as Route}
              className="font-extrabold text-brand-primary hover:underline"
            >
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link
              href={routes.public.privacy as Route}
              className="font-extrabold text-brand-primary hover:underline"
            >
              Política de Privacidade
            </Link>
            .
          </span>
        </label>
        <FieldError message={fieldErrors.termsAccepted} />
      </div>

      <TESButton
        type="submit"
        variant="gradient"
        size="lg"
        disabled={isSubmitting}
        className="min-h-12 w-full rounded-2xl text-base"
      >
        {isSubmitting ? "Criando conta..." : "Criar minha conta"}
      </TESButton>

      <p className="text-center text-sm font-bold text-tesText-secondary">
        Já tem uma conta?{" "}
        <Link
          href={routes.public.therapistSignIn}
          className="text-brand-primary hover:underline"
        >
          Entrar como terapeuta
        </Link>
      </p>
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
        {icon ? <span className="text-tesText-muted">{icon}</span> : null}
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
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} className="mt-2 text-xs font-bold text-status-danger">
      {message}
    </p>
  );
}
