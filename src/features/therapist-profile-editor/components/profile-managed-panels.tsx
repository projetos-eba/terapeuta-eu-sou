import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  CreditCard,
  Star,
  WalletCards,
} from "lucide-react";

import { TherapistPlan } from "@/domain/tes";
import {
  canAccessTherapistPlan,
  TherapistLockedCard,
} from "@/features/therapist-access";
import { routes } from "@/lib/routes";

import type { TherapistProfileEditorData } from "../therapist-profile-editor.types";
import { ProfileReadOnlyMetric } from "./profile-read-only-metric";
import { ProfileSection } from "./profile-section";

export function ProfileDerivedMetrics({
  editor,
}: {
  editor: TherapistProfileEditorData;
}) {
  if (!canAccessTherapistPlan(editor.derived.plan, TherapistPlan.Premium)) {
    return (
      <TherapistLockedCard
        requiredPlan={TherapistPlan.Premium}
        title="Resumo do perfil"
        variant="section"
      />
    );
  }

  const derived = editor.derived;

  return (
    <ProfileSection
      description="Um resumo das informações que já estão conectadas ao seu perfil."
      title="Resumo do perfil"
    >
      <dl className="grid gap-3">
        <ProfileReadOnlyMetric
          label="Avaliação média"
          value={derived.averageRating?.toFixed(1) ?? "Ainda sem dados"}
        />
        <ProfileReadOnlyMetric
          label="Avaliações"
          value={String(derived.reviewCount)}
        />
        <ProfileReadOnlyMetric
          label="Sessões concluídas"
          value={String(derived.completedSessions)}
        />
        <ProfileReadOnlyMetric
          label="Preço inicial"
          value={formatPrice(derived.startingPriceCents)}
        />
        <ProfileReadOnlyMetric label="Plano" value={planLabel(derived.plan)} />
        <ProfileReadOnlyMetric
          label="Agendamentos"
          value={
            derived.canReceiveBookings
              ? "Pode receber"
              : "Ainda não pode receber"
          }
        />
      </dl>
    </ProfileSection>
  );
}

export function ProfileManagedElsewhere({
  plan = TherapistPlan.PremiumPlus,
}: {
  plan?: TherapistPlan;
} = {}) {
  return (
    <ProfileSection
      description="Cada parte fica no lugar certo para você encontrar e atualizar com facilidade."
      title="Outras partes do seu perfil"
    >
      <div className="grid gap-3">
        <ManagedLink
          href={routes.therapist.services}
          icon={<WalletCards aria-hidden="true" size={18} />}
          label="Terapias e preços"
          plan={plan}
          suffix="Editar em Suas terapias"
        />
        <ManagedLink
          href={routes.therapist.agenda}
          icon={<CalendarDays aria-hidden="true" size={18} />}
          label="Horários disponíveis"
          plan={plan}
          suffix="Editar em Agenda"
        />
        <ManagedLink
          href={routes.therapist.reviews}
          icon={<Star aria-hidden="true" size={18} />}
          label="Avaliações"
          plan={plan}
          suffix="Ver avaliações"
          requiredPlan={TherapistPlan.Premium}
        />
        <ManagedLink
          href={routes.therapist.finance}
          icon={<CreditCard aria-hidden="true" size={18} />}
          label="Recebimentos"
          plan={plan}
          suffix="Ver financeiro"
        />
      </div>
    </ProfileSection>
  );
}

function ManagedLink({
  href,
  icon,
  label,
  plan,
  suffix,
  requiredPlan,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  plan: TherapistPlan;
  suffix: string;
  requiredPlan?: TherapistPlan;
}) {
  if (requiredPlan && !canAccessTherapistPlan(plan, requiredPlan)) {
    return (
      <TherapistLockedCard
        className="min-h-[120px] rounded-lg border-0 shadow-none"
        requiredPlan={requiredPlan}
        title={label}
        variant="compact"
      />
    );
  }

  return (
    <Link
      className="grid min-h-[56px] grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 text-sm font-bold text-brand-deep transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
      href={href}
    >
      <span className="grid size-[38px] place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        {icon}
      </span>
      <span>{label}</span>
      <span className="hidden items-center gap-2 text-xs font-extrabold text-brand-primary sm:inline-flex">
        {suffix}
        <ArrowRight aria-hidden="true" size={16} />
      </span>
    </Link>
  );
}


function formatPrice(cents: number | null) {
  if (cents === null) return "Ainda sem dados";
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cents / 100);
}

function planLabel(plan: string) {
  if (plan === "premium_plus") return "Premium Plus";
  if (plan === "premium") return "Premium";
  return "Free";
}
