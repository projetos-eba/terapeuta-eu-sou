import Link from "next/link";
import type { Route } from "next";

import { PublicFooter, PublicHeader } from "@/components/tes";
import { routes } from "@/lib/routes";

export default function TherapistProfileNotFound() {
  return (
    <main className="min-h-screen bg-white text-tesText-primary">
      <PublicHeader />
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-display text-5xl font-light italic text-brand-deep">
          Perfil não encontrado
        </h1>
        <p className="mt-5 text-base font-semibold leading-7 text-tesText-secondary">
          Este perfil pode estar em revisão, temporariamente indisponível ou não
          existir mais.
        </p>
        <Link
          href={routes.public.therapists as Route}
          className="mt-8 inline-flex rounded-full bg-brand-primary px-6 py-3 text-sm font-extrabold text-white"
        >
          Ver terapeutas
        </Link>
      </section>
      <PublicFooter />
    </main>
  );
}
