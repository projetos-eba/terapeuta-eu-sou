import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  CreditCard,
  Star,
  WalletCards,
} from "lucide-react";

import { routes } from "@/lib/routes";

import type { TherapistProfileEditorData } from "../therapist-profile-editor.types";
import { ProfileReadOnlyMetric } from "./profile-read-only-metric";
import { ProfileSection } from "./profile-section";

export function ProfileDerivedMetrics({
  editor,
}: {
  editor: TherapistProfileEditorData;
}) {
  const derived = editor.derived;

  return (
    <ProfileSection
      description="Estes valores vêm de serviços, agenda, avaliações e assinatura."
      title="Dados derivados"
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
          label="Reservas"
          value={derived.canReceiveBookings ? "Pronto" : "Pendente"}
        />
      </dl>
    </ProfileSection>
  );
}

export function ProfileManagedElsewhere() {
  return (
    <ProfileSection
      description="Edite estas seções em seus respectivos módulos."
      title="Informações gerenciadas em outras páginas"
    >
      <div className="grid gap-3">
        <ManagedLink
          href={routes.therapist.services}
          icon={<WalletCards aria-hidden="true" size={18} />}
          label="Terapias e preços"
          suffix="Editar em Terapias"
        />
        <ManagedLink
          href={routes.therapist.agenda}
          icon={<CalendarDays aria-hidden="true" size={18} />}
          label="Horários disponíveis"
          suffix="Editar em Agenda"
        />
        <ManagedLink
          href={routes.therapist.reviews}
          icon={<Star aria-hidden="true" size={18} />}
          label="Avaliações"
          suffix="Editar em Avaliações"
        />
        <ManagedLink
          href={routes.therapist.finance}
          icon={<CreditCard aria-hidden="true" size={18} />}
          label="Pagamentos"
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
  suffix,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  suffix: string;
}) {
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
