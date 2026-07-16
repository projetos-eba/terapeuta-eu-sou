"use client";

import { PublicFooter, PublicHeader, TESButton, TESCard } from "@/components/tes";

export default function TherapiesError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#fbf8ff]">
      <PublicHeader />
      <section className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-8">
        <TESCard className="rounded-[32px] p-8 shadow-card">
          <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-brand-primary">
            Catálogo indisponível
          </p>
          <h1 className="mt-4 text-4xl font-semibold italic text-brand-deep">
            Não foi possível carregar as terapias agora.
          </h1>
          <p className="mt-4 text-base font-semibold leading-7 text-text-secondary">
            Tente novamente em instantes. Se preferir, você também pode seguir
            pela jornada guiada.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <TESButton onClick={reset}>Tentar novamente</TESButton>
            <TESButton href="/sua-jornada" variant="secondary">
              Fazer jornada guiada
            </TESButton>
          </div>
        </TESCard>
      </section>
      <PublicFooter />
    </main>
  );
}
