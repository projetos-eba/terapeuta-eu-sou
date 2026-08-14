import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft } from "lucide-react";

import { routes } from "@/lib/routes";

export function SessionDetailHeader() {
  return (
    <header className="grid gap-4 pt-2 sm:pt-4">
      <Link
        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-extrabold text-brand-primary transition hover:text-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        href={routes.patient.encounters as Route<string>}
      >
        <ChevronLeft aria-hidden="true" size={18} />
        Meus encontros
      </Link>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-brand-primary sm:text-xs">
        Encontro agendado
      </p>
      <h1 className="max-w-[760px] font-display text-[2.35rem] font-light italic leading-none text-brand-deep sm:text-[2.8rem] lg:text-[3.2rem]">
        Detalhe do encontro
      </h1>
      <p className="max-w-[720px] text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
        Confirme com quem será seu encontro, qual é o estado atual do acesso e o
        que faz sentido resolver agora, sem sair do fluxo seguro da plataforma.
      </p>
    </header>
  );
}
