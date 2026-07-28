import Link from "next/link";
import type { Route } from "next";
import { Heart, MapPin, Search, Sparkles } from "lucide-react";

import { routes } from "@/lib/routes";

const journeySteps = [
  { icon: Search, label: "Responda algumas perguntas" },
  { icon: Heart, label: "Entenda o que está fazendo sentido agora" },
  { icon: Sparkles, label: "Receba recomendações personalizadas" },
  { icon: MapPin, label: "Encontre o terapeuta ideal para você" },
];

function LeafCluster({ className = "" }: { className?: string }) {
  return (
    <div className={`h-48 w-32 ${className}`}>
      {Array.from({ length: 7 }).map((_, index) => (
        <span
          key={index}
          className="absolute block h-14 w-7 rounded-[100%_0] bg-brand-mint/50"
          style={{
            transform: `translate(${index % 2 ? 44 : 12}px, ${index * 22}px) rotate(${
              index % 2 ? 38 : -34
            }deg)`,
          }}
        />
      ))}
    </div>
  );
}

export function JourneyBanner() {
  return (
    <section className="relative overflow-hidden rounded-hero border border-border bg-[linear-gradient(135deg,var(--tes-color-surface-soft)_0%,var(--tes-color-surface-default)_48%,var(--tes-color-brand-lavender-soft)_100%)] px-7 py-8 shadow-card md:px-12">
      <LeafCluster className="absolute -left-6 bottom-4 opacity-40" />
      <LeafCluster className="absolute -right-6 bottom-4 scale-x-[-1] opacity-40" />
      <div className="relative grid gap-9 lg:grid-cols-[340px_1fr] lg:items-center">
        <div>
          <h2 className="font-display text-3xl font-semibold leading-tight text-brand-deep md:text-4xl">
            Ainda não sabe por onde começar?
          </h2>
          <p className="mt-4 max-w-xs text-sm font-semibold leading-6 text-tesText-secondary">
            Nossa ferramenta de Jornada pode te ajudar a entender o que você
            precisa e indicar caminhos com cuidado.
          </p>
          <Link
            href={routes.public.journey as Route}
            className="mt-5 inline-flex rounded-full bg-brand-primary px-7 py-3 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover"
          >
            Começar minha jornada
          </Link>
        </div>

        <ol className="grid gap-5 md:grid-cols-4">
          {journeySteps.map(({ icon: Icon, label }, index) => (
            <li key={label} className="relative text-center">
              {index < journeySteps.length - 1 ? (
                <span className="absolute left-1/2 top-7 hidden h-px w-full border-t border-dashed border-brand-lavender md:block" />
              ) : null}
              <span className="relative mx-auto grid size-16 place-items-center rounded-full border border-brand-lavender bg-white text-brand-primary shadow-card">
                <Icon className="size-7" />
              </span>
              <p className="mx-auto mt-3 max-w-[150px] text-sm font-extrabold leading-5 text-brand-deep">
                {label}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
