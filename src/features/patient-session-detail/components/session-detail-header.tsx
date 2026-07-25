import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft } from "lucide-react";

import { routes } from "@/lib/routes";

export function SessionDetailHeader() {
  return (
    <header>
      <Link
        className="inline-flex items-center gap-2 text-sm font-extrabold text-brand-primary transition hover:text-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        href={routes.patient.encounters as Route<string>}
      >
        <ChevronLeft aria-hidden="true" size={18} />
        Minhas sessões
      </Link>
      <h1 className="mt-6 font-display text-4xl font-light italic leading-tight text-brand-deep md:text-5xl">
        Detalhe da sessão
      </h1>
      <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-tesText-secondary md:text-base">
        Confira todas as informações sobre sua sessão agendada.
      </p>
    </header>
  );
}
