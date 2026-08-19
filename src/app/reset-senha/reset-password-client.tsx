"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { LockKeyhole, Mail } from "lucide-react";

import { TESButton } from "@/components/tes";
import { routes } from "@/lib/routes";

type ApiResponse =
  | { ok: true; message?: string; redirectTo?: string }
  | { ok: false; message: string };

export function ResetPasswordClient({ token }: { token: string }) {
  const hasToken = Boolean(token);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/password/request-reset", {
        body: JSON.stringify({ email: String(form.get("email") ?? "") }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as ApiResponse;
      setMessage(
        data.ok
          ? (data.message ??
              "Se o e-mail estiver cadastrado, enviaremos as instrucoes de recuperacao.")
          : data.message,
      );
    } catch {
      setMessage(
        "Se o e-mail estiver cadastrado, enviaremos as instrucoes de recuperacao.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/password/reset", {
        body: JSON.stringify({
          confirmPassword: String(form.get("confirmPassword") ?? ""),
          password: String(form.get("password") ?? ""),
          token,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as ApiResponse;

      if (!data.ok) {
        setError(data.message);
        return;
      }

      setMessage("Senha atualizada com seguranca.");
      window.setTimeout(() => {
        window.location.assign(data.redirectTo ?? routes.public.clientSignIn);
      }, 1200);
    } catch {
      setError("Nao foi possivel redefinir a senha agora.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-brand-lavenderSoft px-4 py-10">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-2xl items-center">
        <div className="w-full rounded-3xl border border-border bg-white p-6 shadow-soft sm:p-10">
          <div className="mb-6 inline-flex size-12 items-center justify-center rounded-2xl bg-brand-lavenderSoft text-brand-primary">
            {hasToken ? (
              <LockKeyhole className="size-6" aria-hidden="true" />
            ) : (
              <Mail className="size-6" aria-hidden="true" />
            )}
          </div>
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-brand-primary">
            Recuperacao de senha
          </p>
          <h1 className="mt-3 font-display text-4xl font-light italic leading-tight text-brand-deep sm:text-5xl">
            {hasToken ? "Crie uma nova senha" : "Recupere seu acesso"}
          </h1>
          <p className="mt-4 text-base font-semibold leading-7 text-tesText-secondary">
            {hasToken
              ? "Escolha uma senha com pelo menos 8 caracteres."
              : "Informe seu e-mail e enviaremos as instrucoes quando houver uma conta elegivel."}
          </p>

          {message ? (
            <p
              role="status"
              className="mt-6 rounded-2xl bg-status-successBg px-4 py-3 text-sm font-bold text-status-success"
            >
              {message}
            </p>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="mt-6 rounded-2xl bg-status-dangerBg px-4 py-3 text-sm font-bold text-status-danger"
            >
              {error}
            </p>
          ) : null}

          {hasToken ? (
            <form
              method="post"
              onSubmit={handleReset}
              className="mt-8 space-y-5"
            >
              <PasswordField name="password" label="Nova senha" />
              <PasswordField
                name="confirmPassword"
                label="Confirmar nova senha"
              />
              <TESButton
                type="submit"
                variant="gradient"
                size="lg"
                disabled={isSubmitting}
                className="min-h-12 w-full rounded-2xl"
              >
                {isSubmitting ? "Salvando..." : "Salvar nova senha"}
              </TESButton>
            </form>
          ) : (
            <form
              method="post"
              onSubmit={handleRequest}
              className="mt-8 space-y-5"
            >
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
              <TESButton
                type="submit"
                variant="gradient"
                size="lg"
                disabled={isSubmitting}
                className="min-h-12 w-full rounded-2xl"
              >
                {isSubmitting ? "Enviando..." : "Enviar instrucoes"}
              </TESButton>
            </form>
          )}

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

function PasswordField({ label, name }: { label: string; name: string }) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-extrabold text-brand-deep"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="password"
        autoComplete="new-password"
        className="min-h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm font-bold text-brand-deep outline-none focus:ring-4 focus:ring-ring/20"
        placeholder="Minimo de 8 caracteres"
      />
    </div>
  );
}
