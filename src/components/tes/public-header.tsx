"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useState, type ReactNode } from "react";
import {
  ChevronRight,
  ClipboardCheck,
  LogIn,
  Menu,
  Search,
  UserRound,
  X,
} from "lucide-react";

import { routes } from "@/lib/routes";

import { PublicAuthMenu, usePublicAuthState } from "./public-auth-menu";
import { TESButton } from "./tes-button";

function Logo({ header = false }: { header?: boolean }) {
  return (
    <Link
      href={routes.public.home as Route}
      className={
        header
          ? "relative block h-14 w-36 shrink-0 sm:h-16 sm:w-[168px]"
          : "relative block h-12 w-[122px] shrink-0 sm:h-[56px] sm:w-[142px]"
      }
      aria-label="Terapeuta Eu Sou"
    >
      <Image
        src="/logo-oficial-terapeuta-eu-sou.png"
        alt="Terapeuta Eu Sou"
        fill
        sizes={header ? "(min-width: 640px) 168px, 144px" : "142px"}
        className="object-contain"
        priority
      />
    </Link>
  );
}

export function PublicHeader({ showMobileSearch = false }: { showMobileSearch?: boolean } = {}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const authState = usePublicAuthState();
  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const nav: Array<[string, Route]> = [
    ["O que é o TES?", routes.public.about as Route],
    ["Terapias", routes.public.therapies as Route],
    ["Sua Jornada", routes.public.journey as Route],
    ["Terapeutas", routes.public.therapists as Route],
    ["Para Terapeutas", routes.public.forTherapists as Route],
  ];

  return (
    <header className="relative z-50 w-full bg-white">
      <div className="mx-auto max-w-[1680px] px-5 py-4 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between gap-4">
          <Logo header />
          <nav className="hidden items-center gap-11 text-sm font-bold text-tesText-secondary xl:flex">
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
          <div className="hidden items-center gap-3 xl:flex">
            <PublicAuthMenu authState={authState} className="block" />
            <TESButton
              href={routes.public.journey}
              variant="gradient"
              size="lg"
              className="px-5 sm:px-7"
            >
              Começar minha jornada
            </TESButton>
          </div>
          <div className="flex items-center gap-3 xl:hidden">
            {showMobileSearch ? (
              <Link
                href={routes.public.therapists as Route}
                aria-label="Buscar terapeutas"
                className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-brand-lavender bg-white text-brand-deep shadow-card hover:border-brand-primary hover:bg-brand-lavenderSoft focus:outline-none focus:ring-4 focus:ring-ring/20"
              >
                <Search className="size-6" aria-hidden="true" />
              </Link>
            ) : null}
            <button
              type="button"
              aria-controls="public-mobile-menu"
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
              className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-brand-lavender bg-white text-brand-primary shadow-card hover:border-brand-primary hover:bg-brand-lavenderSoft focus:outline-none focus:ring-4 focus:ring-ring/20 xl:hidden"
              onClick={() => setIsMobileMenuOpen((current) => !current)}
            >
              {isMobileMenuOpen ? (
                <X className="size-5" aria-hidden="true" />
              ) : (
                <Menu className="size-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {isMobileMenuOpen ? (
          <div
            id="public-mobile-menu"
            className="absolute left-5 right-5 top-[calc(100%+8px)] z-[80] overflow-hidden rounded-[24px] border border-brand-lavender bg-white shadow-float xl:hidden"
          >
            <PublicAuthMenu
              authState={authState}
              onNavigate={closeMobileMenu}
              variant="mobile-account"
            />
            <div className="grid gap-2 p-4">
              <p className="px-2 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-primary">
                Navegação
              </p>
              {nav.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="flex min-h-12 items-center justify-between rounded-2xl px-3 text-base font-extrabold text-brand-deep hover:bg-brand-lavenderSoft focus:outline-none focus:ring-4 focus:ring-ring/20"
                  onClick={closeMobileMenu}
                >
                  {label}
                  <ChevronRight className="size-5" aria-hidden="true" />
                </Link>
              ))}
            </div>
            {authState.status === "guest" ? (
              <div className="border-t border-brand-lavender bg-surface-muted p-4">
                <p className="px-2 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-primary">
                  Login e cadastro
                </p>
                <div className="mt-3 grid gap-3">
                  <MobileAuthLink
                    href={routes.public.clientSignIn}
                    icon={<UserRound className="size-5" aria-hidden="true" />}
                    label="Entrar como cliente"
                    onClick={closeMobileMenu}
                  />
                  <MobileAuthLink
                    href={routes.public.therapistSignIn}
                    icon={
                      <ClipboardCheck className="size-5" aria-hidden="true" />
                    }
                    label="Entrar como terapeuta"
                    onClick={closeMobileMenu}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export { Logo as PublicLogo };

function MobileAuthLink({
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
      className="flex min-h-12 items-center gap-3 rounded-2xl border border-brand-lavender bg-white px-3 text-sm font-extrabold text-brand-deep shadow-card hover:border-brand-primary hover:bg-brand-lavenderSoft focus:outline-none focus:ring-4 focus:ring-ring/20"
      onClick={onClick}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      <LogIn
        className="size-4 shrink-0 text-brand-primary"
        aria-hidden="true"
      />
    </Link>
  );
}
