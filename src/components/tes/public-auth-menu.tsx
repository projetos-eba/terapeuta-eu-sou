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

type TherapistSummary = {
  displayName: string;
};

type SessionResponse =
  | {
      authenticated: false;
    }
  | {
      authenticated: true;
      patient: PatientSummary;
    }
  | {
      authenticated: true;
      therapist: TherapistSummary;
    };

export type PublicAuthState =
  | {
      status: "guest" | "loading";
    }
  | {
      patient: PatientSummary;
      status: "authenticated";
    }
  | {
      status: "authenticated";
      therapist: TherapistSummary;
    };

export type PublicAuthMenuVariant = "desktop" | "mobile-account";

export function usePublicAuthState(enabled = true): PublicAuthState {
  const [state, setState] = useState<PublicAuthState>({ status: "loading" });

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/client/session", {
          cache: "no-store",
        });
        const data = (await response.json()) as SessionResponse;

        if (!active) return;

        if (data.authenticated) {
          if ("patient" in data) {
            setState({ patient: data.patient, status: "authenticated" });
          } else {
            setState({ status: "authenticated", therapist: data.therapist });
          }
          return;
        }

        const therapistResponse = await fetch("/api/auth/therapist/session", {
          cache: "no-store",
        });
        const therapistData =
          (await therapistResponse.json()) as SessionResponse;

        if (
          active &&
          therapistData.authenticated &&
          "therapist" in therapistData
        ) {
          setState({
            status: "authenticated",
            therapist: therapistData.therapist,
          });
        } else if (active) {
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
  }, [enabled]);

  return state;
}

export function PublicAuthMenu({
  authState,
  className,
  onAuthStateChange,
  onNavigate,
  variant = "desktop",
}: {
  authState?: PublicAuthState;
  className?: string;
  onAuthStateChange?: (state: PublicAuthState) => void;
  onNavigate?: () => void;
  variant?: PublicAuthMenuVariant;
}) {
  const internalState = usePublicAuthState(!authState);
  const [localAuthState, setLocalAuthState] = useState<PublicAuthState | null>(
    null,
  );

  useEffect(() => {
    setLocalAuthState(null);
  }, [authState]);

  const state = localAuthState ?? authState ?? internalState;
  const handleLogoutSuccess = () => {
    const guestState: PublicAuthState = { status: "guest" };
    setLocalAuthState(guestState);
    onAuthStateChange?.(guestState);
  };

  if (variant === "mobile-account") {
    if (state.status !== "authenticated") return null;

    if ("therapist" in state) {
      return (
        <TherapistPopover
          onNavigate={onNavigate}
          onLogoutSuccess={handleLogoutSuccess}
          therapist={state.therapist}
          variant="mobile"
        />
      );
    }

    return (
      <PatientPopover
        onNavigate={onNavigate}
        onLogoutSuccess={handleLogoutSuccess}
        patient={state.patient}
        variant="mobile"
      />
    );
  }

  if (state.status === "authenticated") {
    if ("therapist" in state) {
      return (
        <TherapistPopover
          className={className}
          onNavigate={onNavigate}
          onLogoutSuccess={handleLogoutSuccess}
          therapist={state.therapist}
        />
      );
    }

    return (
      <PatientPopover
        className={className}
        onNavigate={onNavigate}
        onLogoutSuccess={handleLogoutSuccess}
        patient={state.patient}
      />
    );
  }

  return (
    <GuestPopover
      className={className}
      isLoading={state.status === "loading"}
    />
  );
}

function TherapistPopover({
  className,
  onNavigate,
  onLogoutSuccess,
  therapist,
  variant = "popover",
}: {
  className?: string;
  onLogoutSuccess: () => void;
  onNavigate?: () => void;
  therapist: TherapistSummary;
  variant?: "popover" | "mobile";
}) {
  const firstName = getFirstName(therapist.displayName);
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
      const response = await fetch("/api/auth/therapist/session", {
        cache: "no-store",
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("logout_failed");
      }

      onLogoutSuccess();
      onNavigate?.();
      router.replace(routes.public.home);
      router.refresh();
    } catch {
      setLogoutError("Não foi possível sair agora. Tente novamente.");
      setIsLoggingOut(false);
    }
  }

  if (variant === "mobile") {
    return (
      <MobileAccountPanel
        displayName={therapist.displayName}
        roleLabel="Conta terapeuta"
      >
        <MenuLink
          href={routes.therapist.home}
          icon={<LayoutDashboard className="size-5" aria-hidden="true" />}
          label="Meu painel"
          onClick={onNavigate}
        />
        <MenuLink
          href={routes.therapist.profile}
          icon={<UserRound className="size-5" aria-hidden="true" />}
          label="Meu perfil"
          onClick={onNavigate}
        />
        <LogoutButton isLoggingOut={isLoggingOut} onClick={handleLogout} />
        {logoutError ? (
          <p className="px-3 text-xs font-bold leading-5 text-status-danger">
            {logoutError}
          </p>
        ) : null}
      </MobileAccountPanel>
    );
  }

  return (
    <details className={cn("group relative z-[70]", className)}>
      <summary className="inline-flex h-12 cursor-pointer list-none flex-col items-start justify-center rounded-full border border-border bg-white px-6 text-sm font-extrabold leading-tight text-brand-primary shadow-card transition hover:border-brand-lavender focus:outline-none focus:ring-4 focus:ring-ring/20 [&::-webkit-details-marker]:hidden">
        <span>Olá, {firstName}</span>
        <span className="text-[11px] font-bold text-tesText-muted">
          Conta terapeuta
        </span>
      </summary>

      <div className="absolute right-0 top-[calc(100%+14px)] z-50 w-[300px] rounded-[24px] border-2 border-brand-lavender bg-white p-4 text-brand-deep shadow-float">
        <span
          className="absolute right-20 top-[-11px] size-5 rotate-45 border-l-2 border-t-2 border-brand-lavender bg-white"
          aria-hidden="true"
        />
        <p className="px-2 text-lg font-extrabold leading-tight">
          {therapist.displayName}
        </p>
        <p className="mt-1 px-2 text-sm font-bold text-tesText-muted">
          Acompanhe sua agenda e sua presença profissional.
        </p>

        <div className="mt-4 space-y-2">
          <MenuLink
            href={routes.therapist.home}
            icon={<LayoutDashboard className="size-5" aria-hidden="true" />}
            label="Meu painel"
            onClick={onNavigate}
          />
          <MenuLink
            href={routes.therapist.profile}
            icon={<UserRound className="size-5" aria-hidden="true" />}
            label="Meu perfil"
            onClick={onNavigate}
          />
          <LogoutButton isLoggingOut={isLoggingOut} onClick={handleLogout} />
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

function PatientPopover({
  className,
  onNavigate,
  onLogoutSuccess,
  patient,
  variant = "popover",
}: {
  className?: string;
  onLogoutSuccess: () => void;
  onNavigate?: () => void;
  patient: PatientSummary;
  variant?: "popover" | "mobile";
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

      onLogoutSuccess();
      onNavigate?.();
      router.replace(routes.public.home);
      router.refresh();
    } catch {
      setLogoutError("Não foi possível sair agora. Tente novamente.");
      setIsLoggingOut(false);
    }
  }

  if (variant === "mobile") {
    return (
      <MobileAccountPanel
        displayName={patient.displayName}
        roleLabel="Conta cliente"
      >
        <MenuLink
          href={routes.patient.home}
          icon={<LayoutDashboard className="size-5" aria-hidden="true" />}
          label="Meu painel"
          onClick={onNavigate}
        />
        <MenuLink
          href={routes.patient.encounters}
          icon={<CalendarCheck className="size-5" aria-hidden="true" />}
          label="Meus encontros"
          onClick={onNavigate}
        />
        <LogoutButton isLoggingOut={isLoggingOut} onClick={handleLogout} />
        {logoutError ? (
          <p className="px-3 text-xs font-bold leading-5 text-status-danger">
            {logoutError}
          </p>
        ) : null}
      </MobileAccountPanel>
    );
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
            onClick={onNavigate}
          />
          <MenuLink
            href={routes.patient.encounters}
            icon={<CalendarCheck className="size-5" aria-hidden="true" />}
            label="Meus encontros"
            onClick={onNavigate}
          />
          <LogoutButton isLoggingOut={isLoggingOut} onClick={handleLogout} />
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

function MobileAccountPanel({
  children,
  displayName,
  roleLabel,
}: {
  children: ReactNode;
  displayName: string;
  roleLabel: string;
}) {
  return (
    <div className="border-b border-brand-lavender bg-surface-muted p-4">
      <div className="px-2">
        <p className="text-lg font-extrabold leading-tight text-brand-deep">
          {displayName}
        </p>
        <p className="mt-1 text-sm font-bold text-tesText-muted">{roleLabel}</p>
      </div>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function LogoutButton({
  isLoggingOut,
  onClick,
}: {
  isLoggingOut: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-extrabold text-brand-deep transition hover:bg-brand-lavenderSoft focus:outline-none focus:ring-4 focus:ring-ring/20 disabled:cursor-wait disabled:opacity-70"
      disabled={isLoggingOut}
      onClick={onClick}
      type="button"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <LogOut className="size-5" aria-hidden="true" />
      </span>
      {isLoggingOut ? "Saindo..." : "Sair"}
    </button>
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
  onClick,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href as Route}
      className="flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-extrabold text-brand-deep transition hover:bg-brand-lavenderSoft focus:outline-none focus:ring-4 focus:ring-ring/20"
      onClick={onClick}
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
