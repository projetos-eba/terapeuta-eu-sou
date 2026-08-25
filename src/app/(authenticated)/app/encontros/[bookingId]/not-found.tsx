import Link from "next/link";
import type { Route } from "next";

import { AppPageContainer } from "@/components/app-page";
import { routes } from "@/lib/routes";

export default function PatientEncounterDetailNotFound() {
  return (
    <AppPageContainer className="max-w-[720px] py-12 sm:py-20">
      <section className="grid gap-4 rounded-card border border-brand-lavender bg-white p-6 text-center shadow-card sm:p-10">
        <h1 className="font-display text-[2.25rem] font-light italic leading-tight text-brand-deep sm:text-[2.8rem]">
          Este encontro não está disponível
        </h1>
        <p className="mx-auto max-w-xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
          Confira seus encontros para encontrar um horário agendado ou falar com
          o suporte.
        </p>
        <Link
          className="mx-auto inline-flex min-h-11 items-center justify-center rounded-full bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={routes.patient.encounters as Route<string>}
        >
          Ver meus encontros
        </Link>
      </section>
    </AppPageContainer>
  );
}
