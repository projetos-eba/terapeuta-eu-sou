import Link from "next/link";
import type { Route } from "next";
import { Headphones } from "lucide-react";

import { routes } from "@/lib/routes";

export function QuickSupportCard({ bookingId }: { bookingId: string }) {
  return (
    <section className="rounded-card border border-brand-lavender bg-white p-6 shadow-card">
      <div className="flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Headphones aria-hidden="true" size={25} />
        </span>
        <h2 className="font-display text-2xl font-light italic text-brand-deep">
          Suporte rápido
        </h2>
      </div>
      <p className="mt-6 text-sm font-semibold leading-6 text-tesText-secondary">
        Estamos aqui para ajudar você na melhor experiência.
      </p>
      <Link
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        href={`${routes.patient.help}?booking=${bookingId}` as Route<string>}
      >
        Falar com suporte
      </Link>
    </section>
  );
}
