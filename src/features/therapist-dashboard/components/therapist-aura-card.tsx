import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { CircleCheckBig, Crown, Star } from "lucide-react";

import { routes } from "@/lib/routes";

import type { TherapistDashboardPageData } from "../therapist-dashboard.types";

export function TherapistAuraCard({
  aura,
}: {
  aura: TherapistDashboardPageData["aura"];
}) {
  return (
    <section className="relative overflow-hidden rounded-panel border-2 border-[#cdbff0] bg-[#fbf9ff] px-5 py-6 shadow-card sm:px-7">
      <Image
        alt="Aura"
        className="pointer-events-none absolute bottom-0 left-0 hidden h-[270px] w-[180px] object-contain object-bottom sm:block"
        height={975}
        src="/therapist/dashboard/aura.png"
        width={680}
      />
      <div className="sm:pl-[170px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold text-brand-deep">
              Aura ao seu lado
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-status-warningBg px-3 py-1 text-[10px] font-semibold text-brand-deep">
              <Crown aria-hidden="true" className="size-3" />
              TES Premium Plus
            </span>
          </div>
          <Link
            className="text-xs font-bold text-brand-primary outline-none hover:text-brand-deep focus-visible:ring-4 focus-visible:ring-ring/20"
            href={routes.therapist.assessorIa as Route<string>}
          >
            Conversar com a Aura →
          </Link>
        </div>
        {aura ? (
          <div className="mt-6 grid gap-7 xl:grid-cols-2">
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
