"use client";

import type { LucideIcon } from "lucide-react";
import { LockKeyhole, Sparkles } from "lucide-react";
import { type ReactNode, useState } from "react";

import { TESButton, TESDialog } from "@/components/tes";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { TherapistPlan } from "@/domain/tes";

import {
  getTherapistPlanLabel,
  getTherapistUpgradeLabel,
} from "../therapist-plan-access";

type TherapistLockedCardProps = {
  className?: string;
  description?: string;
  dialogBody?: ReactNode;
  dialogDescription?: string;
  dialogTitle?: string;
  icon?: LucideIcon;
  requiredPlan: TherapistPlan;
  title: string;
  triggerLabel?: string;
  variant?: "card" | "compact" | "section";
};

export function TherapistLockedCard({
  className,
  description = "Uma visão criada para ajudar você a acompanhar melhor sua prática, encontrar padrões e tomar decisões com mais clareza.",
  dialogBody,
  dialogDescription,
  dialogTitle = "Um recurso para sua prática",
  icon: Icon = LockKeyhole,
  requiredPlan,
  title,
  triggerLabel = "Conhecer recurso",
  variant = "card",
}: TherapistLockedCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const planLabel = getTherapistPlanLabel(requiredPlan);

  return (
    <>
      <button
        aria-label={`${title}. Recurso disponível no ${planLabel}. Abrir detalhes.`}
        className={cn(
          "group relative block w-full overflow-hidden rounded-panel border border-brand-lavender/80 bg-white text-left shadow-card transition hover:border-brand-primary hover:shadow-float focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20",
          variant === "card" && "min-h-[278px] p-5",
          variant === "section" && "min-h-[320px] p-5 sm:p-6",
          variant === "compact" && "min-h-[156px] p-4",
          className,
        )}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <div className="flex items-start justify-between gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-lavenderSoft text-brand-primary">
            <Icon aria-hidden="true" size={20} />
          </span>
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-brand-lavenderSoft px-3 text-[11px] font-extrabold text-brand-primary">
            <LockKeyhole aria-hidden="true" size={13} />
            {planLabel}
          </span>
        </div>

        <div className="mt-5">
          <h2 className="text-base font-extrabold leading-6 text-brand-deep">
            {title}
          </h2>
          <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-tesText-secondary">
            {description}
          </p>
        </div>

        <div aria-hidden="true" className="mt-6 grid gap-3 opacity-80">
          <span className="h-3 w-[72%] rounded-full bg-brand-lavenderSoft blur-[2px]" />
          <span className="h-3 w-full rounded-full bg-brand-lavenderSoft blur-[2px]" />
          <span className="h-3 w-[54%] rounded-full bg-brand-lavenderSoft blur-[2px]" />
        </div>

        <span className="absolute bottom-4 right-5 inline-flex items-center gap-1.5 text-xs font-extrabold text-brand-primary">
          <Sparkles aria-hidden="true" size={14} />
          {triggerLabel}
        </span>
      </button>

      {isOpen ? (
        <TESDialog
          description={
            dialogDescription ??
            `Este recurso faz parte do plano ${planLabel}. Ele foi pensado para ajudar você a acompanhar melhor sua prática, encontrar padrões e tomar decisões com mais clareza.`
          }
          onClose={() => setIsOpen(false)}
          title={dialogTitle}
        >
          <div className="grid gap-5">
            <div className="grid size-12 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
              <LockKeyhole aria-hidden="true" size={22} />
            </div>
            {dialogBody ?? (
              <p className="text-sm font-semibold leading-6 text-tesText-primary">
                Seu plano atual continua pronto para a operação essencial.
                Quando fizer sentido para você, conheça o {planLabel} e
                desbloqueie esta visão.
              </p>
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <TESButton
                onClick={() => setIsOpen(false)}
                type="button"
                variant="ghost"
              >
                Continuar por aqui
              </TESButton>
              <TESButton href={routes.therapist.plan}>
                {getTherapistUpgradeLabel(requiredPlan)}
              </TESButton>
            </div>
          </div>
        </TESDialog>
      ) : null}
    </>
  );
}
