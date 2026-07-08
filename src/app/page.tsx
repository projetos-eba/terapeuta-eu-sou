import Link from 'next/link';
import type { Route } from 'next';

import { routes } from '@/lib/routes';

const paths: Array<[string, Route]> = [
  ['Jornada guiada', routes.public.journey as Route],
  ['Buscar terapeutas', routes.public.therapists as Route],
  ['Planos para terapeutas', routes.public.therapistPlans as Route],
  ['Entrar', routes.public.signIn as Route],
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#F4F0FF,transparent_36%),var(--tes-color-surface-page)] px-6 py-16">
      <section className="mx-auto flex max-w-5xl flex-col gap-8 rounded-hero border border-border bg-card p-8 shadow-soft md:p-12">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold text-brand-cyan">Terapeuta Eu Sou</p>
          <h1 className="font-display text-5xl font-semibold leading-tight text-tesText-primary md:text-7xl">
            Uma experiência clara, acolhedora e pronta para crescer.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-tesText-secondary">
            Setup inicial em Next.js, TypeScript, Tailwind CSS e shadcn/ui, com tokens TES
            centralizados para guiar a implementação.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {paths.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="rounded-card border border-border bg-surface-default px-5 py-4 text-sm font-semibold text-tesText-link shadow-card transition hover:-translate-y-0.5 hover:border-brand-lavender hover:shadow-soft focus:outline-none focus:ring-4 focus:ring-ring/20"
            >
              {label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
