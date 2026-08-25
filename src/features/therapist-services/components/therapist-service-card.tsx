"use client";

import { CalendarDays, Clock, HandCoins, Tags } from "lucide-react";
import { useId, useState } from "react";

import { TESCard } from "@/components/tes";
import { TherapistPlan } from "@/domain/tes";
import { cn } from "@/lib/utils";

import type { TherapistServiceSummary } from "../therapist-services.types";
import { formatCurrency } from "./therapist-service-form";
import {
  TherapistServiceMenu,
  type TherapistServiceMenuAction,
} from "./therapist-service-menu";
import { TherapistServiceMetrics } from "./therapist-service-metrics";
import {
  getTherapistServiceStatusLabel,
  TherapistServiceStatusBadge,
} from "./therapist-service-status";

const identityTones = [
  "bg-brand-lavenderSoft",
  "bg-status-successBg",
  "bg-status-warningBg",
  "bg-status-infoBg",
];

export function TherapistServiceCard({
  canMoveDown,
  canMoveUp,
  disabled,
  onAction,
  plan,
  service,
  themeLabels,
}: {
  canMoveDown: boolean;
  canMoveUp: boolean;
  disabled?: boolean;
  onAction: (action: TherapistServiceMenuAction) => void;
  plan: TherapistPlan;
  service: TherapistServiceSummary;
  themeLabels: Array<{ id: string; label: string; slug: string }>;
}) {
  const canToggle =
    service.status === "active" ||
    service.status === "paused" ||
    service.status === "draft";
  const nextAction = service.status === "active" ? "pause" : "activate";
  const description =
    service.description ??
    "Complete a descrição para explicar a proposta da experiência.";
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const canExpandDescription = description.length > 150;

  return (
    <TESCard
      as="article"
      className="overflow-visible rounded-[14px] border-brand-lavender/70 shadow-none"
    >
      <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="grid gap-4 sm:grid-cols-[112px_minmax(0,1fr)]">
          <div
            className={cn(
              "size-24 overflow-hidden rounded-lg sm:size-28",
              !service.therapy.imageUrl
                ? identityTones[
                    Math.abs(hashString(service.therapyId)) %
                      identityTones.length
                  ]
                : "bg-brand-lavenderSoft",
            )}
          >
            {service.therapy.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- imagem vem do catalogo publico administrado.
              <img
                alt={`Imagem da terapia ${service.therapy.name}`}
                className="size-full object-cover"
                src={service.therapy.imageUrl}
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-brand-primary">
                  {service.category.name}
                </p>
                <h3 className="mt-1 font-display text-2xl font-light italic leading-tight text-brand-deep">
                  {service.therapy.name}
                </h3>
              </div>
              <div className="relative z-10 flex items-center gap-2">
                <TherapistServiceStatusBadge status={service.status} />
                <button
                  aria-label={`${service.status === "active" ? "Pausar" : "Ativar"} ${service.title}`}
                  aria-pressed={service.status === "active"}
                  className={cn(
                    "relative h-11 w-[62px] rounded-full p-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary",
                    service.status === "active"
                      ? "bg-brand-primary"
                      : "bg-brand-lavender",
                  )}
                  disabled={disabled || !canToggle}
                  onClick={() => onAction(nextAction)}
                  type="button"
                >
                  <span
                    className={cn(
                      "block size-9 rounded-full bg-white shadow-card transition",
                      service.status === "active"
                        ? "translate-x-[18px]"
                        : "translate-x-0",
                    )}
                  />
                </button>
                <TherapistServiceMenu
                  canMoveDown={canMoveDown}
                  canMoveUp={canMoveUp}
                  disabled={disabled}
                  onAction={onAction}
                  service={service}
                />
              </div>
            </div>
            <p
              className={cn(
                "mt-4 max-w-full break-words text-sm font-semibold leading-6 text-tesText-secondary [overflow-wrap:anywhere]",
                canExpandDescription && !isDescriptionExpanded
                  ? "line-clamp-3"
                  : canExpandDescription
                    ? "max-h-24 overflow-y-auto"
                    : undefined,
              )}
              id={`service-description-${service.serviceId}`}
            >
              {description}
            </p>
            {canExpandDescription ? (
              <button
                aria-controls={`service-description-${service.serviceId}`}
                aria-expanded={isDescriptionExpanded}
                className="mt-2 text-sm font-extrabold text-brand-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
                onClick={() => setIsDescriptionExpanded((current) => !current)}
                type="button"
              >
                {isDescriptionExpanded ? "Mostrar menos" : "Ver mais"}
              </button>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <InfoPill icon={<Clock aria-hidden="true" size={14} />}>
                {service.durationMinutes} min
              </InfoPill>
              <InfoPill icon={<HandCoins aria-hidden="true" size={14} />}>
                {formatCurrency(service.priceCents)}
              </InfoPill>
              <ServiceThemeBadges
                category={service.category}
                serviceName={service.title}
                themes={themeLabels}
              />
              <InfoPill icon={<CalendarDays aria-hidden="true" size={14} />}>
                {service.isReservable ? "Reservável" : "Não reservável"}
              </InfoPill>
            </div>
            {service.blockingReason ? (
              <p className="mt-4 rounded-lg bg-status-warningBg p-3 text-xs font-bold leading-5 text-status-warning">
                {getBlockingReasonLabel(service.blockingReason)}
              </p>
            ) : null}
            {service.status !== "active" ? (
              <p className="mt-3 text-xs font-semibold text-tesText-muted">
                Estado atual: {getTherapistServiceStatusLabel(service.status)}.
              </p>
            ) : null}
          </div>
        </div>
        <TherapistServiceMetrics plan={plan} service={service} />
      </div>
    </TESCard>
  );
}

function InfoPill({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <span className="inline-flex min-h-8 items-center gap-2 rounded-full bg-brand-lavenderSoft px-3 text-xs font-extrabold text-brand-primary">
      {icon}
      {children}
    </span>
  );
}

function ServiceThemeBadges({
  category,
  serviceName,
  themes,
}: {
  category: { id: string; name: string; slug: string };
  serviceName: string;
  themes: Array<{ id: string; label: string; slug: string }>;
}) {
  const [clickedOpen, setClickedOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const tooltipId = useId();
  const hiddenThemes = themes.slice(0, 2);
  const tooltipOpen = clickedOpen || focused || hovered;

  return (
    <ul
      aria-label={`Categoria e temas selecionados para ${serviceName}`}
      className="flex flex-wrap items-center gap-2"
    >
      <li>
        <InfoPill icon={<Tags aria-hidden="true" size={14} />}>
          <span className="max-w-[220px] truncate" title={category.name}>
            {category.name}
          </span>
        </InfoPill>
      </li>
      {hiddenThemes.length > 0 ? (
        <li
          className="relative"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <button
            aria-controls={tooltipId}
            aria-describedby={tooltipOpen ? tooltipId : undefined}
            aria-expanded={tooltipOpen}
            aria-label={`Ver mais ${hiddenThemes.length} ${hiddenThemes.length === 1 ? "tema" : "temas"} de ${serviceName}`}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-brand-lavender bg-brand-lavenderSoft px-3 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavender focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            onBlur={() => setFocused(false)}
            onClick={() => setClickedOpen((current) => !current)}
            onFocus={() => setFocused(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setClickedOpen(false);
                setFocused(false);
                event.currentTarget.blur();
              }
            }}
            type="button"
          >
            +{hiddenThemes.length}
          </button>
          <div
            className={`absolute bottom-full left-0 z-30 mb-2 w-64 rounded-xl border border-brand-lavender bg-white p-3 text-left text-sm font-semibold leading-5 text-tesText-secondary shadow-card ${tooltipOpen ? "block" : "hidden"}`}
            id={tooltipId}
            role="tooltip"
          >
            <p className="font-extrabold text-brand-deep">Outros temas</p>
            <ul className="mt-1 space-y-1">
              {hiddenThemes.map((theme) => (
                <li key={theme.id}>{theme.label}</li>
              ))}
            </ul>
          </div>
        </li>
      ) : null}
    </ul>
  );
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

function getBlockingReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    category_inactive:
      "Esta terapia pertence a uma categoria indisponível no momento.",
    service_archived:
      "Esta terapia foi arquivada e permanece apenas para histórico.",
    service_not_accepting_bookings:
      "Esta terapia não está recebendo agendamentos no momento.",
    service_not_active:
      "Esta terapia precisa ser ativada para receber agendamentos.",
    service_paused:
      "Esta terapia está pausada e não aparece para novos agendamentos.",
    therapist_not_accepting_bookings:
      "Seu perfil não está recebendo agendamentos no momento.",
    therapist_not_approved:
      "Seu perfil ainda precisa estar aprovado para receber agendamentos.",
    therapist_profile_private:
      "Seu perfil público precisa estar publicado para receber agendamentos.",
    therapy_not_public:
      "Esta terapia ainda não está disponível no perfil público.",
    therapy_not_published:
      "Esta terapia ainda não está disponível para as pessoas.",
  };

  return labels[reason] ?? "Esta terapia não está disponível para agendamento.";
}
