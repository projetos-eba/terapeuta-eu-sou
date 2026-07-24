import type { ReactNode } from "react";
import { CheckCircle2, FileCheck2, Landmark, UserRoundCheck } from "lucide-react";

import { PublicLogo } from "@/components/tes";
import { cn } from "@/lib/utils";

const checklist = [
  {
    description: "Você informa somente os dados iniciais de acesso.",
    icon: UserRoundCheck,
    title: "Conta criada",
  },
  {
    description: "Seu perfil nasce privado para você completar com calma.",
    icon: FileCheck2,
    title: "Perfil em rascunho",
  },
  {
    description: "Documentos, verificação e repasse ficam para os próximos passos.",
    icon: Landmark,
    title: "Próximas etapas",
  },
];

export function TherapistAuthShell({
  children,
  eyebrow,
  title,
  description,
  className,
}: {
  children: ReactNode;
  className?: string;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="min-h-screen bg-surface-soft px-5 py-8 text-brand-deep sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col items-center justify-center gap-8">
        <PublicLogo />
        <section className="grid w-full overflow-hidden rounded-hero border border-border bg-surface-default shadow-float lg:grid-cols-[0.92fr_1.08fr]">
          <aside className="order-2 flex flex-col justify-between gap-10 bg-brand-deep px-7 py-8 text-white sm:px-10 lg:order-1 lg:min-h-[760px] lg:px-12 lg:py-12">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-brand-cyan">
                {eyebrow}
              </p>
              <h1 className="mt-6 font-display text-5xl font-light italic leading-[0.98] sm:text-6xl">
                {title}
              </h1>
              <p className="mt-6 max-w-md text-base font-semibold leading-7 text-white/76">
                {description}
              </p>
            </div>

            <div className="space-y-4">
              {checklist.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="flex gap-4 rounded-2xl border border-white/25 bg-white/10 p-4"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/12 text-brand-cyan">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="text-sm font-extrabold">{item.title}</h2>
                      <p className="mt-1 text-sm font-semibold leading-6 text-white/70">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <div
            className={cn(
              "order-1 flex flex-col justify-center px-6 py-7 sm:px-10 sm:py-10 lg:order-2 lg:px-20",
              className,
            )}
          >
            <div className="mb-7 flex w-full items-start gap-2 rounded-2xl bg-status-successBg px-4 py-3 text-sm font-extrabold leading-5 text-status-success sm:items-center">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              <span>
                Informações do perfil público não bloqueiam este primeiro acesso.
              </span>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
