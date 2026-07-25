import { SearchX } from "lucide-react";

import { PublicFooter, PublicHeader, TESButton } from "@/components/tes";
import { routes } from "@/lib/routes";

export default function TherapyDetailNotFound() {
  return (
    <main className="min-h-screen bg-[#fbf8ff] text-brand-deep">
      <PublicHeader />
      <section className="mx-auto flex max-w-[960px] flex-col items-center px-5 py-24 text-center sm:px-8">
        <span className="flex size-24 items-center justify-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <SearchX className="h-11 w-11" aria-hidden="true" />
        </span>
        <h1 className="mt-8 text-4xl font-extrabold leading-tight sm:text-5xl">
          Terapia não encontrada
        </h1>
        <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-text-secondary">
          Esta terapia pode ter sido removida, despublicada ou ainda estar em
          revisão editorial.
        </p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <TESButton href={routes.public.therapies} variant="gradient">
            Ver catálogo de terapias
          </TESButton>
          <TESButton href={routes.public.journey} variant="secondary">
            Fazer jornada guiada
          </TESButton>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
