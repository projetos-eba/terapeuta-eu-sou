import Link from "next/link";
import type { Route } from "next";
import { Headphones } from "lucide-react";

import { routes } from "@/lib/routes";

export function QuickSupportCard({ bookingId }: { bookingId: string }) {
  return (
    <section className="rounded-card border border-border bg-white p-4 shadow-card sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Headphones aria-hidden="true" size={20} />
        </span>
        <h2 className="font-display text-[1.5rem] font-light italic leading-none text-brand-deep sm:text-[1.75rem]">
          Suporte rápido
        </h2>
      </div>
      <p className="mt-5 text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
        Estamos aqui para ajudar você quando precisar de apoio com este
        encontro.
      </p>
      <Link
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand-primary px-5 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        href={
          `${routes.patient.messages}?context=suporte&booking=${bookingId}` as Route<string>
        }
      >
        Falar com suporte
      </Link>
    </section>
  );
}
