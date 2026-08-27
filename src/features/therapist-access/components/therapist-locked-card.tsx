"use client";

import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import {
  Eye,
  Gem,
  LockKeyhole,
  Sparkles,
  SunMedium,
  TrendingUp,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import { TESButton, TESDialog } from "@/components/tes";
import { TherapistPlan } from "@/domain/tes";
import { platformAssets } from "@/lib/platform-assets";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

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

const premiumBenefits = [
  {
    detail: "Entenda padrões com profundidade",
    icon: SunMedium,
    title: "Mais clareza",
  },
  {
    detail: "Monitore e evolua com consistência",
    icon: TrendingUp,
    title: "Acompanhamento da prática",
  },
  {
    detail: "Informações que apoiam suas decisões",
    icon: Eye,
    title: "Visões exclusivas",
  },
] satisfies Array<{ detail: string; icon: LucideIcon; title: string }>;

export function TherapistLockedCard({
  className,
  description = "Uma visão criada para ajudar você a acompanhar melhor sua prática, encontrar padrões e tomar decisões com mais clareza.",
  dialogBody,
  dialogDescription,
  dialogTitle = "Desbloqueie mais recursos para sua prática",
  icon: Icon = LockKeyhole,
  requiredPlan,
  title,
  triggerLabel = "Conhecer recurso",
  variant = "card",
}: TherapistLockedCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const planLabel = getTherapistPlanLabel(requiredPlan);
  const resolvedDialogDescription =
    dialogDescription ??
    `Este recurso faz parte do plano ${planLabel}. Com ele, você tem mais clareza, acompanha melhor sua prática e toma decisões com mais confiança.`;

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
          className="max-h-[calc(100dvh-32px)] max-w-[980px] rounded-[24px] p-5 sm:max-h-[calc(100dvh-48px)] sm:rounded-[28px] sm:p-8"
          description={resolvedDialogDescription}
          hideHeader
          onClose={() => setIsOpen(false)}
          overlayClassName="items-center p-4 sm:p-6"
          title={dialogTitle}
        >
          <div className="min-w-0">
            <div className="pr-14">
              <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-brand-lavenderSoft px-4 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-primary">
                <Gem aria-hidden="true" className="size-4" />
                Recurso {planLabel}
              </span>
            </div>
            <div className="mt-5 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.72fr)] lg:items-start lg:gap-8">
              <div className="order-2 min-w-0 lg:order-1">
                <h2 className="max-w-[620px] font-display text-[2.7rem] font-light leading-[0.98] text-brand-deep sm:text-[3.6rem]">
                  {dialogTitle}
                </h2>
                <span
                  aria-hidden="true"
                  className="mt-6 block h-0.5 w-10 bg-brand-primary/60"
                />
                <p className="mt-5 max-w-[600px] text-base font-semibold leading-7 text-tesText-secondary">
                  {resolvedDialogDescription}
                </p>
                {dialogBody ? <div className="mt-4">{dialogBody}</div> : null}
                <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {premiumBenefits.map(({ detail, icon: Icon, title }) => (
                    <div
                      className="flex min-w-0 items-center gap-3 rounded-2xl border border-brand-lavender/60 bg-white/70 p-3.5"
                      key={title}
                    >
                      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
                        <Icon aria-hidden="true" className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <strong className="block text-sm font-extrabold leading-5 text-brand-deep">
                          {title}
                        </strong>
                        <span className="mt-1 block text-sm font-semibold leading-5 text-tesText-secondary">
                          {detail}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <TESButton
                    className="sm:px-5"
                    onClick={() => setIsOpen(false)}
                    type="button"
                    variant="ghost"
                  >
                    Agora não
                  </TESButton>
                  <TESButton
                    className="sm:min-w-[220px]"
                    href={routes.therapist.plan}
                  >
                    <Gem aria-hidden="true" className="size-5" />
                    {getTherapistUpgradeLabel(requiredPlan)}
                  </TESButton>
                </div>
              </div>
              <div className="order-1 min-w-0 lg:order-2">
                <div className="relative mx-auto aspect-square w-full max-w-[370px] overflow-hidden rounded-[22px] bg-surface-page">
                  <Image
                    alt=""
                    className="object-cover"
                    fill
                    sizes="(min-width: 1024px) 370px, 100vw"
                    src={platformAssets.therapistPremiumLock.src}
                  />
                </div>
              </div>
            </div>
          </div>
        </TESDialog>
      ) : null}
    </>
  );
}
