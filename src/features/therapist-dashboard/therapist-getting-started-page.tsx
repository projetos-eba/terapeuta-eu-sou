import Link from "next/link";
import {
  CalendarDays,
  CreditCard,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import {
  AppPageContainer,
  AppPageHeader,
  AppPageSection,
} from "@/components/app-page";
import { getTherapistPlanDefinition } from "@/domain/tes";
import type { AuthenticatedTherapistSession } from "@/lib/auth/therapist-session";
import { routes } from "@/lib/routes";

type GettingStartedAction = {
  description: string;
  href: string;
  icon: LucideIcon;
  label: string;
  title: string;
};

const actions: GettingStartedAction[] = [
  {
    description:
      "Revise sua apresentação pública, foto, áreas de cuidado e status de publicação.",
    href: routes.therapist.profile,
    icon: UserRound,
    label: "Abrir perfil",
    title: "Complete seu perfil público",
  },
  {
    description:
      "Cadastre suas terapias, preços, duração e disponibilidade para reserva online.",
    href: routes.therapist.services,
    icon: Sparkles,
    label: "Gerenciar terapias",
    title: "Organize suas terapias",
  },
  {
    description:
      "Configure horários recorrentes e bloqueios antes de receber novas reservas.",
    href: routes.therapist.agenda,
    icon: CalendarDays,
    label: "Abrir agenda",
    title: "Prepare sua agenda",
  },
  {
    description:
      "Acompanhe recebimentos e conecte a conta Stripe quando estiver pronto para repasses.",
    href: `${routes.therapist.finance}?tab=conta`,
    icon: CreditCard,
    label: "Ver financeiro",
    title: "Confira sua conta de recebimento",
  },
];

export function TherapistGettingStartedPage({
  session,
}: {
  session: Pick<AuthenticatedTherapistSession, "name" | "plan" | "status">;
}) {
  const plan = getTherapistPlanDefinition(session.plan);

  return (
    <AppPageContainer className="max-w-[1120px] gap-5">
      <AppPageHeader
        eyebrow={plan.name}
        title={`Olá, ${firstName(session.name)}.`}
      >
        Sua área profissional está pronta para os primeiros ajustes. Complete os
        passos essenciais para publicar seu trabalho, receber reservas online e
        acompanhar sua operação com clareza.
      </AppPageHeader>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <AppPageSection className="grid gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-brand-deep">
              Comece por aqui
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              Estes atalhos cobrem o mínimo para um terapeuta novo trabalhar
              bem dentro da plataforma.
            </p>
          </div>

          <ul className="grid gap-3">
            {actions.map((action) => {
              const Icon = action.icon;

              return (
                <li
                  className="grid gap-4 rounded-card border border-brand-lavender bg-white p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                  key={action.href}
                >
                  <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
                    <Icon aria-hidden="true" size={21} />
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-brand-deep">
                      {action.title}
                    </h3>
                    <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                      {action.description}
                    </p>
                  </div>
                  <Link
                    className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                    href={action.href}
                  >
                    {action.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </AppPageSection>

        <AppPageSection className="grid gap-4 self-start">
          <div>
            <h2 className="text-xl font-extrabold text-brand-deep">
              Status atual
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              O plano pago libera os recursos do shell, mas a publicação do
              perfil e a operação diária ainda dependem dos seus dados.
            </p>
          </div>
          <dl className="grid gap-3">
            <StatusRow label="Plano" value={plan.name} />
            <StatusRow label="Perfil" value={statusLabel(session.status)} />
          </dl>
        </AppPageSection>
      </div>
    </AppPageContainer>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-brand-lavender bg-surface-soft p-4">
      <dt className="text-sm font-bold text-tesText-secondary">{label}</dt>
      <dd className="mt-1 text-base font-extrabold text-brand-deep">{value}</dd>
    </div>
  );
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "terapeuta";
}

function statusLabel(status: AuthenticatedTherapistSession["status"]) {
  if (status === "approved") return "Aprovado";
  if (status === "submitted") return "Enviado para revisão";
  if (status === "in_review") return "Em revisão";
  if (status === "changes_requested") return "Ajustes solicitados";
  return "Em rascunho";
}
