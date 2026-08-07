import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
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

import { therapistStatusLabel } from "./therapist-home-readiness.mappers";
import type {
  TherapistHomeChecklistItem,
  TherapistHomeReadiness,
} from "./therapist-home-readiness.types";

const checklistIcons: Record<TherapistHomeChecklistItem["id"], LucideIcon> = {
  agenda: CalendarDays,
  connect: CreditCard,
  profile: UserRound,
  services: Sparkles,
};

export function TherapistGettingStartedPage({
  readiness,
  session,
}: {
  session: Pick<AuthenticatedTherapistSession, "name" | "plan" | "status">;
  readiness: TherapistHomeReadiness;
}) {
  const plan = getTherapistPlanDefinition(session.plan);
  const progressPercent = Math.round(
    readiness.requiredCount > 0
      ? (readiness.completedRequiredCount / readiness.requiredCount) * 100
      : 100,
  );

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
              Checklist de primeiros passos
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              Complete estes pontos para trocar esta tela por uma visão geral
              operacional com seus indicadores reais.
            </p>
            <div
              aria-label={`${readiness.completedRequiredCount} de ${readiness.requiredCount} passos concluídos`}
              className="mt-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-extrabold text-brand-deep">
                  {readiness.completedRequiredCount} de{" "}
                  {readiness.requiredCount} concluídos
                </span>
                <span className="text-sm font-extrabold text-brand-primary">
                  {progressPercent}%
                </span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-brand-lavenderSoft">
                <div
                  className="h-full rounded-full bg-brand-primary transition-[width]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          <ul className="grid gap-3">
            {readiness.checklist.map((item) => {
              const Icon = checklistIcons[item.id];
              const StatusIcon = statusIcon(item.state);

              return (
                <li
                  className="grid gap-4 rounded-card border border-brand-lavender bg-white p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                  key={item.id}
                >
                  <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
                    <Icon aria-hidden="true" size={21} />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-extrabold text-brand-deep">
                        {item.title}
                      </h3>
                      {!item.required ? (
                        <span className="inline-flex min-h-7 items-center rounded-full bg-surface-soft px-3 text-xs font-extrabold text-tesText-secondary">
                          Recomendado
                        </span>
                      ) : null}
                      <span
                        className={`inline-flex min-h-7 items-center gap-1 rounded-full px-3 text-xs font-extrabold ${statusClass(
                          item.state,
                        )}`}
                      >
                        <StatusIcon aria-hidden="true" size={14} />
                        {statusLabel(item.state)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                      {item.description}
                    </p>
                  </div>
                  <Link
                    className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                    href={item.href}
                  >
                    {item.actionLabel}
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
            <StatusRow
              label="Checklist"
              value={`${readiness.completedRequiredCount}/${readiness.requiredCount}`}
            />
            <StatusRow
              label="Perfil"
              value={therapistStatusLabel(session.status)}
            />
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

function statusIcon(state: TherapistHomeChecklistItem["state"]) {
  if (state === "complete") return CheckCircle2;
  if (state === "in_review") return Clock3;
  if (state === "attention") return AlertTriangle;
  return Clock3;
}

function statusLabel(state: TherapistHomeChecklistItem["state"]) {
  if (state === "complete") return "Concluído";
  if (state === "in_review") return "Em análise";
  if (state === "attention") return "Atenção";
  return "Pendente";
}

function statusClass(state: TherapistHomeChecklistItem["state"]) {
  if (state === "complete") return "bg-status-successBg text-status-success";
  if (state === "attention") return "bg-status-warningBg text-status-warning";
  if (state === "in_review") return "bg-brand-lavenderSoft text-brand-primary";
  return "bg-surface-soft text-tesText-secondary";
}
