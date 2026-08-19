import Link from "next/link";
import { CalendarDays, Download } from "lucide-react";

import { AppPageContainer } from "@/components/app-page";
import { TESDecorativeMedia } from "@/components/tes";
import { routes } from "@/lib/routes";
import { platformAssets } from "@/lib/platform-assets";

import type {
  TherapistMetricsCommonMeta,
  TherapistMetricsTab,
} from "../therapist-metrics.types";

export function TherapistMetricsLayout({
  children,
  meta,
  tab,
}: {
  children: React.ReactNode;
  meta: TherapistMetricsCommonMeta;
  tab: TherapistMetricsTab;
}) {
  return (
    <AppPageContainer className="max-w-[1280px] gap-6 lg:gap-8">
      <MetricsHero meta={meta} tab={tab} />
      {children}
    </AppPageContainer>
  );
}

function MetricsHero({
  meta,
  tab,
}: {
  meta: TherapistMetricsCommonMeta;
  tab: TherapistMetricsTab;
}) {
  const tabs: Array<{ label: string; value: TherapistMetricsTab }> = [
    { label: "Visão geral", value: "overview" },
    { label: "Sessões", value: "sessions" },
    { label: "Interesse", value: "interest" },
  ];

  return (
    <section className="overflow-hidden rounded-panel bg-white">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.82fr)]">
        <div className="grid content-between gap-8 p-5 sm:p-8 lg:p-10">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-primary">
              Seu acompanhamento
            </p>
            <h1 className="mt-3 font-display text-[44px] font-light italic leading-none text-brand-deep sm:text-[58px]">
              Métricas e insights
            </h1>
            <p className="mt-5 max-w-[610px] text-base font-semibold leading-7 text-tesText-secondary sm:text-lg">
              Acompanhe como as pessoas encontram seu perfil, agendam sessões e
              interagem com seu trabalho. Use estes dados para tomar decisões
              com mais clareza.
            </p>
          </div>

          <nav
            aria-label="Visões de métricas"
            className="flex min-h-12 w-full items-end gap-1 border-b border-brand-lavender"
          >
            {tabs.map((item) => {
              const active = item.value === tab;
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`relative inline-flex min-h-12 items-center justify-center px-3 text-sm font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:px-5 sm:text-base ${
                    active
                      ? "text-brand-deep after:absolute after:inset-x-3 after:bottom-0 after:h-1 after:rounded-full after:bg-brand-primary sm:after:inset-x-5"
                      : "text-tesText-secondary hover:text-brand-deep"
                  }`}
                  href={`${routes.therapist.insights}?tab=${item.value}&period=${meta.periodDays}`}
                  key={item.value}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="relative min-h-[250px] bg-brand-lavenderSoft sm:min-h-[310px] lg:min-h-full">
          <TESDecorativeMedia
            className="absolute inset-0"
            fade="left"
            objectPosition="right center"
            priority
            sizes="(min-width: 1024px) 42vw, 100vw"
            src={platformAssets.therapistMetricsHero.src}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-brand-lavender px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
            <CalendarDays aria-hidden="true" size={19} />
          </span>
          <div>
            <p className="text-sm font-extrabold text-brand-deep">
              Últimos {meta.periodDays} dias completos
            </p>
            <p className="mt-0.5 text-sm font-semibold leading-5 text-tesText-secondary">
              {formatPeriod(meta)} · {meta.timezone}
            </p>
          </div>
        </div>

        <form
          action={routes.therapist.insights}
          className="flex flex-wrap items-center gap-2"
        >
          <input name="tab" type="hidden" value={tab} />
          <label className="sr-only" htmlFor="metrics-period">
            Período das métricas
          </label>
          <select
            className="min-h-11 rounded-lg border border-brand-lavender bg-white px-3 text-sm font-extrabold text-brand-deep outline-none transition focus-visible:ring-2 focus-visible:ring-brand-primary"
            defaultValue={String(meta.periodDays)}
            id="metrics-period"
            name="period"
          >
            <option value="30">30 dias</option>
            <option value="90">90 dias</option>
          </select>
          <button
            className="min-h-11 rounded-lg bg-brand-primary px-4 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            type="submit"
          >
            Atualizar
          </button>
          <a
            aria-label="Baixar relatório em CSV"
            className="inline-flex size-11 items-center justify-center rounded-lg border border-brand-lavender bg-white text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:w-auto sm:gap-2 sm:px-4"
            download
            href={`/api/therapist/metrics/export?tab=${tab}&period=${meta.periodDays}`}
            title="Baixar relatório em CSV"
          >
            <Download aria-hidden="true" size={18} />
            <span className="hidden sm:inline">Baixar relatório</span>
          </a>
        </form>
      </div>
    </section>
  );
}

function formatPeriod(meta: TherapistMetricsCommonMeta) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: meta.timezone,
    year: "numeric",
  });
  const inclusiveEnd = new Date(new Date(meta.periodEnd).getTime() - 1_000);

  return `${formatter.format(new Date(meta.periodStart))} a ${formatter.format(inclusiveEnd)}`;
}
