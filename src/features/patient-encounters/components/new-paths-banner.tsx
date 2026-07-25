import Link from "next/link";
import type { Route } from "next";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

import { routes } from "@/lib/routes";

export function NewPathsBanner() {
  return (
    <section
      aria-labelledby="patient-new-paths-title"
      className="relative overflow-hidden rounded-card bg-brand-primary p-6 text-white shadow-card"
    >
      <div className="relative z-10 max-w-sm">
        <h2
          id="patient-new-paths-title"
          className="font-display text-3xl font-light italic leading-tight md:text-4xl"
        >
          Quer encontrar novos caminhos?
        </h2>
        <p className="mt-4 text-sm font-semibold leading-6 text-white/85">
          Descubra terapeutas e abordagens que fazem sentido para o que você
          está vivendo.
        </p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-extrabold text-brand-primary shadow-card transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          href={routes.public.journey as Route<string>}
        >
          Fazer meu Match TES
          <ArrowRight aria-hidden="true" size={17} />
        </Link>
      </div>
      <Image
        alt=""
        className="absolute bottom-0 right-0 hidden h-full w-[46%] object-cover opacity-35 md:block"
        height={360}
        src="/journey/hero-section-fade.png"
        width={420}
      />
    </section>
  );
}
