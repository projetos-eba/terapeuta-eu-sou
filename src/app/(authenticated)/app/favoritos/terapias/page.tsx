import Link from "next/link";
import type { Route } from "next";
import { Heart, Search } from "lucide-react";

import { routes } from "@/lib/routes";

export default function PatientFavoriteTherapiesRoute() {
  return (
    <main className="pb-10 text-tesText-primary">
      <section className="rounded-card border border-brand-lavender bg-white p-8 text-center shadow-card">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Heart aria-hidden="true" size={28} />
        </span>
        <h1 className="mt-5 font-display text-4xl font-light italic text-brand-deep">
          Terapias favoritas
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-tesText-secondary">
          Ainda não há terapias salvas para sua conta. Enquanto isso, você pode
          explorar o catálogo e encontrar caminhos para continuar sua jornada.
        </p>
        <Link
          className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={routes.public.therapies as Route<string>}
        >
          <Search aria-hidden="true" size={18} />
          Explorar terapias
        </Link>
      </section>
    </main>
  );
}
