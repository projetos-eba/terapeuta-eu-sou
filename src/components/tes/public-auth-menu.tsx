"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import {
  CalendarCheck,
  ChevronRight,
  ClipboardCheck,
  LayoutDashboard,
  LogIn,
  LogOut,
  UserRound,
} from "lucide-react";

import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

type PatientSummary = {
  displayName: string;
};

type SessionResponse =
  | {
      authenticated: false;
    }
  | {
      authenticated: true;
      patient: PatientSummary;
    };

type AuthState =
  | {
      status: "guest" | "loading";
    }
  | {
      patient: PatientSummary;
      status: "authenticated";
    };

export function PublicAuthMenu({
  className = "hidden sm:block",
}: {
  className?: string;
}) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/client/session", {
          cache: "no-store",
        });
        const data = (await response.json()) as SessionResponse;

        if (!active) return;

        if (data.authenticated) {
          setState({ patient: data.patient, status: "authenticated" });
        } else {
          setState({ status: "guest" });
        }
      } catch {
        if (active) setState({ status: "guest" });
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  if (state.status === "authenticated") {
    return <PatientPopover className={className} patient={state.patient} />;
  }

  return (
    <GuestPopover
      className={className}
      isLoading={state.status === "loading"}
    />
  );
}

function PatientPopover({
  className,
  patient,
}: {
  className?: string;
  patient: PatientSummary;
}) {
  const firstName = getFirstName(patient.displayName);
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleLogout(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (isLoggingOut) return;

    setIsLoggingOut(true);
    setLogoutError(null);

    try {
      const response = await fetch("/api/auth/client/session", {
        cache: "no-store",
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("logout_failed");
      }

      router.replace(routes.public.home);
      router.refresh();
    } catch {
      setLogoutError("Não foi possível sair agora. Tente novamente.");
      setIsLoggingOut(false);
    }
  }

  return (
    <details className={cn("group relative z-[70]", className)}>
      <summary className="inline-flex h-12 cursor-pointer list-none flex-col items-start justify-center rounded-full border border-border bg-white px-6 text-sm font-extrabold leading-tight text-brand-primary shadow-card transition hover:border-brand-lavender focus:outline-none focus:ring-4 focus:ring-ring/20 [&::-webkit-details-marker]:hidden">
        <span>Olá, {firstName}</span>
        <span className="text-[11px] font-bold text-tesText-muted">
          Conta cliente
        </span>
      </summary>

      <div className="absolute right-0 top-[calc(100%+14px)] z-50 w-[300px] rounded-[24px] border-2 border-brand-lavender bg-white p-4 text-brand-deep shadow-float">
        <span
          className="absolute right-20 top-[-11px] size-5 rotate-45 border-l-2 border-t-2 border-brand-lavender bg-white"
          aria-hidden="true"
        />
        <p className="px-2 text-lg font-extrabold leading-tight">
          {patient.displayName}
        </p>
        <p className="mt-1 px-2 text-sm font-bold text-tesText-muted">
          Acompanhe seus encontros e preferências.
        </p>

        <div className="mt-4 space-y-2">
          <MenuLink
            href={routes.patient.home}
            icon={<LayoutDashboard className="size-5" aria-hidden="true" />}
            label="Meu painel"
          />
          <MenuLink
            href={routes.patient.encounters}
            icon={<CalendarCheck className="size-5" aria-hidden="true" />}
            label="Meus encontros"
          />
          <button
            className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-extrabold text-brand-deep transition hover:bg-brand-lavenderSoft focus:outline-none focus:ring-4 focus:ring-ring/20 disabled:cursor-wait disabled:opacity-70"
            disabled={isLoggingOut}
            onClick={handleLogout}
            type="button"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
              <LogOut className="size-5" aria-hidden="true" />
            </span>
            {isLoggingOut ? "Saindo..." : "Sair"}
          </button>
          {logoutError ? (
            <p className="px-3 text-xs font-bold leading-5 text-status-danger">
              {logoutError}
            </p>
          ) : null}
        </div>
      </div>
    </details>
  );
}

function GuestPopover({
  className,
  isLoading,
}: {
  className?: string;
  isLoading: boolean;
}) {
  return (
    <details
      aria-busy={isLoading}
      className={cn("group relative z-[70]", className)}
    >
      <summary className="inline-flex h-12 cursor-pointer list-none items-center justify-center gap-2 rounded-full border border-border bg-white px-6 text-sm font-extrabold text-brand-primary shadow-card transition hover:border-brand-lavender focus:outline-none focus:ring-4 focus:ring-ring/20 [&::-webkit-details-marker]:hidden">
        <LogIn className="size-4" aria-hidden="true" />
        <span aria-live="polite">Entrar | Cadastre-se</span>
      </summary>

      <div className="absolute right-0 top-[calc(100%+14px)] z-50 w-[360px] rounded-[24px] border-2 border-brand-lavender bg-white p-5 text-brand-deep shadow-float">
        <span
          className="absolute right-24 top-[-11px] size-5 rotate-45 border-l-2 border-t-2 border-brand-lavender bg-white"
          aria-hidden="true"
        />
        <p className="text-2xl font-extrabold leading-tight">Quem é você?</p>
        <p className="mt-2 text-base font-bold text-tesText-muted">
          Escolha como deseja entrar
        </p>

        <div className="mt-5 space-y-3">
          <LoginOption
            href={routes.public.therapistSignIn}
            icon={<ClipboardCheck className="size-6" aria-hidden="true" />}
            label="Entrar como terapeuta"
          />
          <LoginOption
            href={routes.public.clientSignIn}
            icon={<UserRound className="size-6" aria-hidden="true" />}
            label="Entrar como cliente"
          />
        </div>
      </div>
    </details>
  );
}

function LoginOption({
  href,
  icon,
  label,
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href as Route}
      className="flex min-h-[76px] items-center gap-4 rounded-2xl border border-border bg-white px-4 text-base font-extrabold text-brand-deep shadow-card transition hover:border-brand-lavender hover:bg-brand-lavenderSoft focus:outline-none focus:ring-4 focus:ring-ring/20"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      <ChevronRight
        className="size-6 shrink-0 text-brand-deep"
        aria-hidden="true"
      />
    </Link>
  );
}

function MenuLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href as Route}
      className="flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-extrabold text-brand-deep transition hover:bg-brand-lavenderSoft focus:outline-none focus:ring-4 focus:ring-ring/20"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
    </Link>
  );
}

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || "cliente";
}
