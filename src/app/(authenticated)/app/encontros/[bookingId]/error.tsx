"use client";

import Link from "next/link";
import type { Route } from "next";
import { AlertCircle, RefreshCw } from "lucide-react";

import { TESButton } from "@/components/tes/tes-button";
import { AppPageContainer } from "@/components/app-page";
import { routes } from "@/lib/routes";

export default function PatientEncounterDetailError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppPageContainer className="max-w-[720px] py-12 sm:py-20">
      <section className="grid gap-5 rounded-card border border-brand-lavender bg-white p-6 text-center shadow-card sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-status-warningBg text-status-warning">
          <AlertCircle aria-hidden="true" size={26} />
        </span>
        <h1 className="font-display text-[2.25rem] font-light italic leading-tight text-brand-deep sm:text-[2.8rem]">
          Não foi possível carregar este encontro agora
        </h1>
        <p className="mx-auto max-w-xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
          Tente novamente em alguns instantes. Se o problema continuar, nossa
          equipe pode ajudar você pelos canais de suporte.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <TESButton onClick={reset} variant="primary">
            <RefreshCw aria-hidden="true" size={18} />
            Tentar novamente
          </TESButton>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            href={routes.patient.encounters as Route<string>}
          >
            Ver meus encontros
          </Link>
        </div>
      </section>
    </AppPageContainer>
  );
}
