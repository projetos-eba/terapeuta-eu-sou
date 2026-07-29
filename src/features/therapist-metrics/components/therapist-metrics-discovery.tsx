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
        <p className="text-sm font-extrabold text-brand-primary">
          Descoberta do perfil
        </p>
        <h2
          className="mt-1 text-xl font-extrabold text-brand-deep"
          id="metrics-discovery-title"
        >
          Da busca ao início do agendamento
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          Estes sinais observam somente o caminho até o seu perfil. Não há
          comparação com outros profissionais nem tendência agregada do portal.
        </p>
      </div>

      {discovery.status !== "ready" ? (
        <DiscoveryState status={discovery.status} />
      ) : (
        <>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <DiscoveryStage
              counter={discovery.stages.searchImpressions}
              icon={Search}
              label="Aparições na busca"
            />
            <DiscoveryStage
              counter={discovery.stages.profileViews}
              icon={Eye}
              label="Aberturas do perfil"
            />
            <DiscoveryStage
              counter={discovery.stages.bookingFlowStarts}
              icon={Sparkles}
              label="Inícios de agendamento"
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <FunnelRate
              label="Busca para perfil"
              value={discovery.funnel.searchToProfile}
            />
            <FunnelRate
              label="Perfil para agendamento"
              value={discovery.funnel.profileToBooking}
            />
          </div>
        </>
      )}
    </AppPageSection>
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
      body: "Os primeiros sinais aparecerão aqui após a coleta e a consolidação diária.",
      title: "Preparando os primeiros dados",
    },
    unavailable: {
      body: "A coleta permanece desativada até a validação formal de privacidade e retenção. Seus dados operacionais continuam disponíveis normalmente.",
      title: "Sinais de descoberta ainda não ativados",
    },
  } as const;

  const state = status === "ready" ? content.processing : content[status];

  return (
    <div className="mt-6 rounded-lg border border-brand-lavender bg-brand-lavenderSoft/45 p-5">
      <p className="text-base font-extrabold text-brand-deep">{state.title}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {state.body}
      </p>
    </div>
  );
}

function DiscoveryStage({
  counter,
  icon: Icon,
  label,
}: {
  counter: TherapistMetricCounter<"events">;
  icon: typeof Search;
  label: string;
}) {
  return (
    <article className="rounded-lg border border-brand-lavender p-4">
      <div className="flex items-center justify-between gap-3">
        <Icon aria-hidden="true" className="text-brand-primary" size={20} />
        <span className="text-xs font-extrabold text-brand-primary">
          {directionLabel(counter.direction)}
        </span>
      </div>
      <p className="mt-5 text-sm font-bold text-tesText-secondary">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-brand-deep">
        {counter.value.toLocaleString("pt-BR")}
      </p>
      <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
        {getTherapistMetricCopy(counter.directionCopyKey)}
      </p>
    </article>
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
      <article className="rounded-lg bg-surface-soft p-4">
        <p className="text-sm font-extrabold text-brand-deep">{label}</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          Disponível após {value.minimumSample} sinais elegíveis. A amostra
          atual ainda é pequena para uma taxa estável.
        </p>
      </article>
    );
  }

  return (
    <article className="rounded-lg bg-surface-soft p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-extrabold text-brand-deep">{label}</p>
        <ArrowRight aria-hidden="true" className="text-status-info" size={19} />
      </div>
      <p className="mt-2 text-2xl font-extrabold text-brand-deep">
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

function directionLabel(direction: "down" | "stable" | "up") {
  if (direction === "up") return "Subiu";
  if (direction === "down") return "Caiu";
  return "Estável";
}
