import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { routes } from "@/lib/routes";

export type TherapistAgendaTab = "bloqueios" | "calendario" | "horarios";

const agendaTabs: Array<{
  href: Route;
  id: TherapistAgendaTab;
  label: string;
}> = [
  {
    href: `${routes.therapist.agenda}?aba=calendario` as Route,
    id: "calendario",
    label: "Calendário",
  },
  {
    href: `${routes.therapist.agenda}?aba=horarios` as Route,
    id: "horarios",
    label: "Horários",
  },
  {
    href: `${routes.therapist.agenda}?aba=bloqueios` as Route,
    id: "bloqueios",
    label: "Bloqueios",
  },
];

export function TherapistAgendaHeader({
  actions,
  activeTab,
}: {
  actions?: ReactNode;
  activeTab: TherapistAgendaTab;
}) {
  return (
    <>
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-[36px] font-light italic leading-[0.98] text-brand-deep sm:text-[42px] lg:text-[52px]">
            Minha agenda
          </h1>
          <p className="mt-3 max-w-[560px] text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
            Organize seus horários, acompanhe seus encontros e mantenha sua
            agenda sempre atualizada.
          </p>
        </div>
        {actions ? (
          <div className="lg:shrink-0">{actions}</div>
        ) : null}
      </header>

      <TherapistAgendaTabs activeTab={activeTab} />
    </>
  );
}

export function TherapistAgendaTabs({
  activeTab,
}: {
  activeTab: TherapistAgendaTab;
}) {
  return (
    <nav
      aria-label="Seções da agenda"
      className="mt-6 grid max-w-[520px] grid-cols-3 border-b border-brand-lavender/70"
    >
      {agendaTabs.map((tab) => (
        <Link
          aria-current={tab.id === activeTab ? "page" : undefined}
          className={`relative flex min-h-12 items-center justify-center px-3 text-sm font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-primary ${
            tab.id === activeTab
              ? "text-brand-deep after:absolute after:inset-x-3 after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-brand-primary"
              : "text-tesText-secondary hover:text-brand-primary"
          }`}
          href={tab.href}
          key={tab.id}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
