import Image from "next/image";
import Link from "next/link";
import { Download } from "lucide-react";

import { AppPageContainer, AppPageSection } from "@/components/app-page";
import { routes } from "@/lib/routes";

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
    <AppPageContainer className="gap-5">
      <MetricsHero periodDays={meta.periodDays} tab={tab} />

      <AppPageSection className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-extrabold text-brand-deep">
            Últimos {meta.periodDays} dias completos
          </p>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            {formatPeriod(meta)}
          </p>
          <p className="text-xs font-semibold leading-5 text-tesText-muted">
            Horário de referência: {meta.timezone}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <form
            action={routes.therapist.insights}
            className="flex flex-col gap-2 sm:items-end"
          >
            <input name="tab" type="hidden" value={tab} />
            <label
              className="text-sm font-extrabold text-brand-deep"
              htmlFor="metrics-period"
            >
              Período
            </label>
            <div className="flex flex-wrap gap-2">
              <select
                className="min-h-11 rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
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
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                download
                href={`/api/therapist/metrics/export?tab=${tab}&period=${meta.periodDays}`}
              >
                <Download aria-hidden="true" size={18} />
                Baixar relatório
              </a>
            </div>
          </form>
        </div>
      </AppPageSection>

      {children}
    </AppPageContainer>
  );
}

function MetricsHero({
  periodDays,
  tab,
}: {
  periodDays: 30 | 90;
  tab: TherapistMetricsTab;
}) {
  const tabs: Array<{ label: string; value: TherapistMetricsTab }> = [
    { label: "Visão geral", value: "overview" },
    { label: "Sessões", value: "sessions" },
    { label: "Interesse", value: "interest" },
  ];

  return (
    <section className="overflow-hidden rounded-card border border-brand-lavender bg-white shadow-card">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid content-between gap-7 p-5 sm:p-7 lg:p-8">
          <div>
            <h1 className="font-display text-[38px] font-light italic leading-tight text-brand-deep sm:text-[52px]">
              Métricas &amp; Relatórios
            </h1>
            <p className="mt-3 max-w-[590px] text-sm font-semibold leading-6 text-brand-primary sm:text-base">
              Acompanhe o movimento dos seus atendimentos e perceba mudanças ao
              longo do tempo, sempre com comparações do seu próprio histórico.
            </p>
          </div>

          <nav aria-label="Visões de métricas" className="flex flex-wrap gap-1">
            {tabs.map((item) => {
              const active = item.value === tab;
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`relative inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary ${
                    active
                      ? "bg-brand-lavenderSoft text-brand-deep after:absolute after:inset-x-4 after:bottom-0 after:h-1 after:rounded-full after:bg-brand-primary"
                      : "text-tesText-secondary hover:bg-brand-lavenderSoft"
                  }`}
                  href={`${routes.therapist.insights}?tab=${item.value}&period=${periodDays}`}
                  key={item.value}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="relative min-h-[220px] bg-brand-lavenderSoft sm:min-h-[280px] lg:min-h-[330px]">
          <Image
            alt=""
            className="object-cover"
            fill
            priority
            sizes="(min-width: 1024px) 420px, 100vw"
            src="/therapist/dashboard/therapist-hero.png"
          />
        </div>
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
