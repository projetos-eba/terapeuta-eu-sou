import { ArrowRight, Eye, Search, Sparkles } from "lucide-react";

import { AppPageSection } from "@/components/app-page";

import { getTherapistMetricCopy } from "../therapist-metrics.copy";
import type {
  TherapistMetricCounter,
  TherapistMetricSampledValue,
  TherapistMetricsOverview,
} from "../therapist-metrics.types";

export function TherapistMetricsDiscovery({
  discovery,
}: {
  discovery: TherapistMetricsOverview["discovery"];
}) {
  return (
    <AppPageSection aria-labelledby="metrics-discovery-title">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.15em] text-brand-primary">
          Jornada até o agendamento
        </p>
        <h2
          className="mt-2 text-2xl font-extrabold text-brand-deep"
          id="metrics-discovery-title"
        >
          Da descoberta ao início da reserva
        </h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary">
          Estas informações mostram somente o caminho até o seu perfil. Não há
          comparação com outros profissionais nem tendência agregada do portal.
        </p>
      </div>

      {discovery.status !== "ready" ? (
        <DiscoveryState status={discovery.status} />
      ) : (
        <DiscoveryFunnel discovery={discovery} />
      )}
    </AppPageSection>
  );
}

function DiscoveryFunnel({
  discovery,
}: {
  discovery: TherapistMetricsOverview["discovery"];
}) {
  const stages = [
    {
      counter: discovery.stages.searchImpressions,
      icon: Search,
      label: "Aparições na busca",
    },
    {
      counter: discovery.stages.profileViews,
      icon: Eye,
      label: "Aberturas do perfil",
    },
    {
      counter: discovery.stages.bookingFlowStarts,
      icon: Sparkles,
      label: "Inícios de agendamento",
    },
  ];
  const maximum = Math.max(1, ...stages.map((stage) => stage.counter.value));

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(250px,0.62fr)]">
      <ol className="grid content-center gap-3 rounded-lg bg-surface-soft p-4 sm:p-6">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const width = Math.max(40, (stage.counter.value / maximum) * 100);
          return (
            <li
              className="mx-auto w-full max-w-[560px]"
              key={stage.label}
              style={{ width: width + "%" }}
            >
              <article
                className="flex min-h-16 items-center justify-between gap-3 bg-brand-primary px-4 py-3 text-white shadow-card transition hover:bg-brand-primaryHover"
                style={{
                  clipPath:
                    index === stages.length - 1
                      ? "polygon(12% 0, 88% 0, 100% 100%, 0 100%)"
                      : "polygon(8% 0, 92% 0, 100% 100%, 0 100%)",
                }}
              >
                <div className="ml-2 flex min-w-0 items-center gap-2">
                  <Icon aria-hidden="true" className="shrink-0" size={18} />
                  <span className="text-sm font-extrabold">{stage.label}</span>
                </div>
                <strong className="mr-2 text-lg font-extrabold">
                  {stage.counter.value.toLocaleString("pt-BR")}
                </strong>
              </article>
            </li>
          );
        })}
      </ol>

      <div className="grid content-start gap-3">
        <FunnelRate
          label="Busca para perfil"
          value={discovery.funnel.searchToProfile}
        />
        <FunnelRate
          label="Perfil para agendamento"
          value={discovery.funnel.profileToBooking}
        />
      </div>
    </div>
  );
}

function DiscoveryState({
  status,
}: {
  status: TherapistMetricsOverview["discovery"]["status"];
}) {
  const content = {
    empty: {
      body: "A coleta está ativa, mas ainda não houve eventos neste período.",
      title: "Ainda sem movimento registrado",
    },
    processing: {
      body: "As primeiras informações aparecerão aqui assim que os dados forem reunidos.",
      title: "Preparando os primeiros dados",
    },
    unavailable: {
      body: "A coleta permanece desativada até a validação formal de privacidade e retenção. Seus dados operacionais continuam disponíveis normalmente.",
      title: "Dados de descoberta ainda não ativados",
    },
  } as const;

  const state = status === "ready" ? content.processing : content[status];

  return (
    <div className="mt-6 rounded-lg border border-brand-lavender bg-brand-lavenderSoft/45 p-5">
      <p className="text-base font-extrabold text-brand-deep">{state.title}</p>
      <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary">
        {state.body}
      </p>
    </div>
  );
}

function FunnelRate({
  label,
  value,
}: {
  label: string;
  value: TherapistMetricSampledValue<"percent">;
}) {
  if (value.status === "insufficient_sample") {
    return (
      <article className="rounded-lg border border-brand-lavender bg-white p-4">
        <p className="text-sm font-extrabold text-brand-deep">{label}</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          Disponível após {value.minimumSample} registros. Ainda estamos
          reunindo dados suficientes para mostrar uma taxa confiável.
        </p>
      </article>
    );
  }

  return (
    <article className="rounded-lg border border-brand-lavender bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-extrabold text-brand-deep">{label}</p>
        <ArrowRight
          aria-hidden="true"
          className="text-brand-primary"
          size={19}
        />
      </div>
      <p className="mt-4 text-3xl font-extrabold text-brand-deep">
        {value.value.toLocaleString("pt-BR", {
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        })}
        %
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {getTherapistMetricCopy(value.directionCopyKey)}
      </p>
    </article>
  );
}
