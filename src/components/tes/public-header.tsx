import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { ChevronRight, ClipboardCheck, LogIn, UserRound } from "lucide-react";

import { routes } from "@/lib/routes";

import { TESButton } from "./tes-button";

function Logo() {
  return (
    <Link
      href={routes.public.home as Route}
      className="relative block h-[56px] w-[142px]"
      aria-label="Terapeuta Eu Sou"
    >
      <Image
        src="/logo-oficial-terapeuta-eu-sou.png"
        alt="Terapeuta Eu Sou"
        fill
        sizes="142px"
        className="object-contain"
        priority
      />
    </Link>
  );
}

export function PublicHeader() {
  const nav: Array<[string, Route]> = [
    ["Como funciona", routes.public.howItWorks as Route],
    ["Terapias", routes.public.therapies as Route],
    ["Sua Jornada", routes.public.journey as Route],
    ["Terapeutas", routes.public.therapists as Route],
    ["Para Terapeutas", routes.public.forTherapists as Route],
  ];

  return (
    <header className="mx-auto flex w-full max-w-[1680px] items-center justify-between gap-6 px-5 py-7 sm:px-8 lg:px-12">
      <Logo />
      <nav className="hidden items-center gap-11 text-sm font-bold text-tesText-secondary lg:flex">
        {nav.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="transition hover:text-brand-primary focus:outline-none focus:ring-4 focus:ring-ring/20"
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        <LoginPopover />
        <TESButton
          href={routes.public.journey}
          variant="gradient"
          size="lg"
          className="px-5 sm:px-7"
        >
          Começar minha jornada
        </TESButton>
      </div>
    </header>
  );
}

function LoginPopover() {
  return (
    <details className="group relative hidden sm:block">
      <summary className="inline-flex h-12 cursor-pointer list-none items-center justify-center gap-2 rounded-full border border-border bg-white px-6 text-sm font-extrabold text-brand-primary shadow-card transition hover:border-brand-lavender focus:outline-none focus:ring-4 focus:ring-ring/20 [&::-webkit-details-marker]:hidden">
        <LogIn className="size-4" aria-hidden="true" />
        Entrar | Cadastre-se
      </summary>

      <div className="absolute right-0 top-[calc(100%+14px)] z-50 w-[360px] rounded-[24px] border-2 border-brand-lavender bg-white p-5 text-brand-deep shadow-float">
        <span
          className="absolute right-24 top-[-11px] size-5 rotate-45 border-l-2 border-t-2 border-brand-lavender bg-white"
          aria-hidden="true"
        />
        <p className="text-2xl font-extrabold leading-tight">
          Quem é você?
        </p>
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
  icon: React.ReactNode;
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
      <ChevronRight className="size-6 shrink-0 text-brand-deep" aria-hidden="true" />
    </Link>
  );
}

export { Logo as PublicLogo };
