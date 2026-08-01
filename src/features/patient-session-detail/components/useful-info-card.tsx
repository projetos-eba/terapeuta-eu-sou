import Link from "next/link";
import type { Route } from "next";

import { routes } from "@/lib/routes";

const usefulLinks = [
  {
    href: `${routes.patient.messages}?context=suporte&topic=encontro-online`,
    label: "Como funciona o encontro online?",
  },
  {
    href: `${routes.patient.messages}?context=suporte&topic=problema-tecnico`,
    label: "O que fazer se tiver problemas técnicos?",
  },
  {
    href: `${routes.patient.messages}?context=suporte&topic=reagendamento`,
    label: "Como reagendar meu encontro?",
  },
];

export function UsefulInfoCard() {
  return (
    <section className="rounded-card border border-brand-lavender bg-white p-6 shadow-card">
      <h2 className="font-display text-2xl font-light italic text-brand-deep">
        Informações úteis
      </h2>
      <nav
        aria-label="Informações úteis do encontro"
        className="mt-5 divide-y divide-brand-lavender"
      >
        {usefulLinks.map((link) => (
          <Link
            className="flex min-h-16 items-center justify-between gap-4 py-4 text-sm font-semibold leading-5 text-tesText-secondary transition hover:text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            href={link.href as Route<string>}
            key={link.label}
          >
            {link.label}
            <span
              aria-hidden="true"
              className="text-xl font-extrabold text-brand-primary"
            >
              ›
            </span>
          </Link>
        ))}
      </nav>
    </section>
  );
}
