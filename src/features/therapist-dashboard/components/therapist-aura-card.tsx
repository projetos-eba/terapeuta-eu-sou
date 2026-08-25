import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { CircleCheckBig, Crown, Star } from "lucide-react";

import { TherapistPlan } from "@/domain/tes";
import {
  canAccessTherapistPlan,
  TherapistLockedCard,
} from "@/features/therapist-access";
import { routes } from "@/lib/routes";

import type { TherapistDashboardPageData } from "../therapist-dashboard.types";

export function TherapistAuraCard({
  aura,
  auraState = "empty",
  plan = TherapistPlan.PremiumPlus,
}: {
  aura: TherapistDashboardPageData["aura"];
  auraState?: TherapistDashboardPageData["auraState"];
  plan?: TherapistPlan;
}) {
  if (!canAccessTherapistPlan(plan, TherapistPlan.PremiumPlus)) {
    return (
      <TherapistLockedCard
        requiredPlan={TherapistPlan.PremiumPlus}
        title="Assessora Aura"
        variant="section"
      />
    );
  }

  return (
    <section className="relative overflow-hidden rounded-panel border-2 border-brand-lavender bg-surface-soft px-5 py-6 shadow-card sm:px-7">
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[210px] items-end justify-center sm:flex">
        <Image
          alt="Assessora Aura"
          className="h-[270px] w-[180px] object-contain object-bottom"
          height={975}
          src="/therapist/dashboard/aura.png"
          width={680}
        />
      </div>
      <div className="sm:pl-[210px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold text-brand-deep">
              Assessora Aura ao seu lado
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-status-warningBg px-3 py-1 text-[11px] font-semibold text-brand-deep">
              <Crown aria-hidden="true" className="size-3" />
              Premium Plus
            </span>
          </div>
          <Link
            className="text-xs font-bold text-brand-primary outline-none hover:text-brand-deep focus-visible:ring-4 focus-visible:ring-ring/20"
            href={routes.therapist.assessorIa as Route<string>}
          >
            Abrir a Assessora Aura →
          </Link>
        </div>
        {aura ? (
          <>
            <p className="mt-4 text-xs font-semibold text-tesText-muted">
              Leitura por regras determinísticas · {aura.periodDays} dias ·
              atualizada em {formatDateTime(aura.computedAt)}
            </p>
            <div className="mt-5 grid gap-7 xl:grid-cols-2">
              <AuraList
                icon={CircleCheckBig}
                items={aura.observations}
                title="Aura observou"
              />
              <AuraList
                icon={Star}
                items={aura.suggestions}
                title="Sugestões para sua jornada"
              />
            </div>
          </>
        ) : auraState === "unavailable" ? (
          <p className="mt-7 max-w-2xl text-sm leading-6 text-tesText-secondary">
            A Assessora Aura não conseguiu atualizar esta leitura agora. Abra a
            página da Aura para tentar novamente.
          </p>
        ) : (
          <p className="mt-7 max-w-2xl text-sm leading-6 text-tesText-secondary">
            A Aura ainda não tem recomendações para este período. Seu painel
            continua disponível com os indicadores atuais.
          </p>
        )}
      </div>
    </section>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function AuraList({
  icon: Icon,
  items,
  title,
}: {
  icon: typeof Star;
  items: string[];
  title: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-bold text-brand-deep">{title}</h3>
      {items.length ? (
        <ul className="mt-3 space-y-3">
          {items.slice(0, 4).map((item) => (
            <li
              className="flex gap-3 text-xs leading-5 text-tesText-secondary"
              key={item}
            >
              <Icon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-brand-primary"
              />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-tesText-muted">
          Sem novos sinais neste período.
        </p>
      )}
    </div>
  );
}
