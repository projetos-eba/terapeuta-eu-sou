"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Check, Gem, LockKeyhole, Mail, Star, UserRound } from "lucide-react";

import {
  PasswordVisibilityToggle,
  PhoneInput,
  TESButton,
} from "@/components/tes";
import {
  TherapistPlan,
  getPlanFeatureDefinition,
  therapistPlanDefinitions,
  type PlanDefinition,
} from "@/domain/tes";
import { routes } from "@/lib/routes";
import { announceAuthSession } from "@/lib/auth/session-marker";
import { cn } from "@/lib/utils";

import type { TherapistAuthApiError } from "../errors";
import type { TherapistAuthFieldErrors } from "../types";
import { getTherapistPlanLabel } from "../validation";

type SignupResponse =
  | { ok: true; redirectTo: string }
  | ({ ok: false } & TherapistAuthApiError);

export function TherapistPlanSelection() {
  return (
    <section className="w-full space-y-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-brand-primary">
          Cadastro inicial
        </p>
        <h1 className="mt-3 font-display text-5xl font-light italic leading-tight text-brand-deep sm:text-6xl">
          Escolha seu plano
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base font-semibold leading-7 text-tesText-secondary">
          A conta nasce segura no TES. Recursos pagos só são liberados depois da
          confirmação segura do pagamento.
        </p>
      </div>

      <div className="grid w-full gap-5 md:grid-cols-3">
        {therapistPlanDefinitions.map((plan) => (
          <PlanSelectionCard key={plan.code} plan={plan} />
        ))}
      </div>

      <p className="text-center text-sm font-bold text-tesText-secondary">
        Já tem uma conta?{" "}
        <Link
          href={routes.public.therapistSignIn}
          className="inline-flex min-h-11 items-center text-brand-primary hover:underline"
        >
          Entrar como terapeuta
        </Link>
      </p>
    </section>
  );
}

function PlanSelectionCard({ plan }: { plan: PlanDefinition }) {
  const Icon =
    plan.code === TherapistPlan.PremiumPlus
      ? Gem
      : plan.code === TherapistPlan.Premium
        ? Star
        : UserRound;
  const primaryFeatures = plan.features
    .map((featureCode) => getPlanFeatureDefinition(featureCode))
    .filter((feature): feature is NonNullable<typeof feature> =>
      Boolean(feature),
    )
    .slice(0, 3);

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-2xl border bg-white p-5 shadow-card",
        plan.highlight
          ? "border-brand-primary ring-4 ring-brand-lavenderSoft"
          : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "grid size-11 place-items-center rounded-full",
            plan.highlight
              ? "bg-brand-primary text-white"
              : "bg-brand-lavenderSoft text-brand-primary",
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        {plan.highlight ? (
          <span className="rounded-full bg-brand-lavenderSoft px-3 py-1 text-[11px] font-extrabold uppercase text-brand-primary">
            Recomendado
          </span>
        ) : null}
      </div>
      <h2 className="mt-5 text-xl font-extrabold text-brand-deep">
        {plan.name}
      </h2>
      <p className="mt-1 min-h-10 text-sm font-semibold leading-5 text-tesText-secondary">
        {plan.subtitle}
      </p>
      <p className="mt-4 font-display text-3xl font-semibold italic text-brand-deep">
        {plan.priceLabel}
      </p>
      <p className="mt-1 text-xs font-bold leading-5 text-tesText-muted">
        {plan.priceNote}
      </p>
      <ul className="mt-5 space-y-2">
        {primaryFeatures.map((feature) => (
          <li
            key={feature.code}
            className="flex items-start gap-2 text-xs font-bold leading-5 text-tesText-secondary"
          >
            <Check className="mt-0.5 size-4 shrink-0 text-status-success" />
            <span>{feature.label}</span>
          </li>
        ))}
      </ul>
      <TESButton
        href={plan.signupHref}
        variant={plan.highlight ? "gradient" : "secondary"}
        className="mt-5 min-h-11 w-full rounded-2xl xl:mt-auto"
      >
        Selecionar {plan.name}
      </TESButton>
    </article>
  );
}

export function TherapistSignupForm({ plan }: { plan: TherapistPlan }) {
  const [fieldErrors, setFieldErrors] = useState<TherapistAuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("55");

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
          phoneCountryCode: String(form.get("phoneCountryCode") ?? "55"),
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

      announceAuthSession("therapist");
      window.location.assign(data.redirectTo);
    } catch {
      setFormError("Não foi possível conectar agora. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      method="post"
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5"
    >
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-brand-primary">
          Cadastro inicial
        </p>
        <h2 className="mt-3 font-display text-4xl font-light italic leading-tight text-brand-deep sm:text-5xl">
          Crie sua conta de terapeuta
        </h2>
        <p className="mt-3 text-base font-semibold leading-7 text-tesText-secondary">
          Plano selecionado:{" "}
          <strong className="text-brand-primary">
            {getTherapistPlanLabel(plan)}
          </strong>
          .
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
        <PhoneInput
          countryCode={phoneCountryCode}
          error={fieldErrors.phone}
          id="phone"
          label="Celular"
          name="phone"
          onCountryCodeChange={setPhoneCountryCode}
          onPhoneChange={setPhone}
          phone={phone}
          required
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
          label="Confirmar senha"
          name="confirmPassword"
          placeholder="Digite a senha novamente"
          type="password"
        />
      </div>

      <div>
        <div className="flex items-start gap-3 text-sm font-semibold leading-6 text-tesText-secondary">
          <input
            aria-describedby="therapist-terms-accepted-description"
            aria-label="Li e concordo com os Termos de Uso e a Política de Privacidade."
            id="therapist-terms-accepted"
            name="termsAccepted"
            type="checkbox"
            className="mt-1 size-5 shrink-0 rounded border-border text-brand-primary focus:ring-brand-primary"
          />
          <p id="therapist-terms-accepted-description">
            <label
              className="cursor-pointer"
              htmlFor="therapist-terms-accepted"
            >
              Li e concordo com os
            </label>{" "}
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
          </p>
        </div>
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
          className="inline-flex min-h-11 items-center text-brand-primary hover:underline"
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
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const inputType = type === "password" && isPasswordVisible ? "text" : type;

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
          type={inputType}
          suppressHydrationWarning
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="min-h-12 w-full bg-transparent text-sm font-bold text-brand-deep outline-none placeholder:text-tesText-subtle"
        />
        {type === "password" ? (
          <PasswordVisibilityToggle
            isVisible={isPasswordVisible}
            onToggle={() => setIsPasswordVisible((current) => !current)}
          />
        ) : null}
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
