import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";

import { routes } from "@/lib/routes";

import { PublicAuthMenu } from "./public-auth-menu";
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
        <PublicAuthMenu />
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

export { Logo as PublicLogo };
