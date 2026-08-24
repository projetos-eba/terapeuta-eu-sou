import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";

import { routes } from "@/lib/routes";

export function SessionDetailHeader() {
  return (
    <header className="pt-1 sm:pt-2">
      <nav
        aria-label="Trilha de navegação"
        className="hidden items-center gap-2 text-sm font-semibold text-tesText-secondary sm:flex"
      >
        <Link
          className="inline-flex min-h-11 items-center gap-2 rounded-md px-1 text-brand-primary transition hover:text-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={routes.patient.home as Route<string>}
        >
          <Home aria-hidden="true" size={16} />
          Início
        </Link>
        <ChevronRight
          aria-hidden="true"
          className="text-brand-lavender"
          size={16}
        />
        <Link
          className="inline-flex min-h-11 items-center rounded-md px-1 text-brand-primary transition hover:text-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={routes.patient.encounters as Route<string>}
        >
          Meus encontros
        </Link>
        <ChevronRight
          aria-hidden="true"
          className="text-brand-lavender"
          size={16}
        />
        <span aria-current="page" className="text-brand-deep">
          Detalhe do encontro
        </span>
      </nav>

      <div className="flex items-center gap-3 sm:hidden">
        <Link
          aria-label="Voltar para meus encontros"
          className="grid size-11 shrink-0 place-items-center rounded-full border border-brand-lavender bg-white text-brand-primary shadow-card transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={routes.patient.encounters as Route<string>}
        >
          <ChevronLeft aria-hidden="true" size={22} />
        </Link>
        <h1 className="font-display text-[2rem] font-light italic leading-none text-brand-deep">
          Detalhe do encontro
        </h1>
      </div>

      <h1 className="sr-only">Detalhe do encontro</h1>
    </header>
  );
}
