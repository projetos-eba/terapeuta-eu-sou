"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  BadgeCheck,
  CalendarDays,
  ExternalLink,
  Heart,
  Play,
  Sparkles,
  Star,
} from "lucide-react";

import type { PublicTherapistProfile } from "@/features/therapist-profile/types";

import { ProfileSection } from "./profile-section";

export function PublicProfilePreview({
  current,
  draft,
  mode,
  onModeChange,
  publicHref,
}: {
  current: PublicTherapistProfile;
  draft: PublicTherapistProfile;
  mode: "draft" | "published";
  onModeChange: (mode: "draft" | "published") => void;
  publicHref: string;
}) {
  const profile = mode === "draft" ? draft : current;

  return (
    <ProfileSection className="overflow-hidden p-0" title="Prévia pública">
      <div className="border-b border-brand-lavender p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div
          aria-label="Selecionar contexto de prévia"
          className="grid rounded-full border border-brand-lavender bg-brand-lavenderSoft p-1 text-sm font-extrabold sm:inline-grid sm:grid-cols-2"
          role="group"
        >
          <button
            aria-pressed={mode === "published"}
            className="min-h-11 rounded-full px-4 text-brand-primary aria-pressed:bg-white aria-pressed:text-brand-deep aria-pressed:shadow-card"
            onClick={() => onModeChange("published")}
            type="button"
          >
            Versão pública atual
          </button>
          <button
            aria-pressed={mode === "draft"}
            className="min-h-11 rounded-full px-4 text-brand-primary aria-pressed:bg-white aria-pressed:text-brand-deep aria-pressed:shadow-card"
            onClick={() => onModeChange("draft")}
            type="button"
          >
            Prévia das alterações
          </button>
        </div>
        <Link
          className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-extrabold text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary sm:mt-0"
          href={publicHref}
        >
          Abrir perfil público
          <ExternalLink aria-hidden="true" size={16} />
        </Link>
      </div>

      <article className="bg-[linear-gradient(180deg,var(--tes-color-surface-default)_0%,var(--tes-color-surface-soft)_100%)]">
        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[240px_1fr]">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[42%] bg-brand-lavenderSoft">
            {/* eslint-disable-next-line @next/next/no-img-element -- preview usa URLs públicas dinâmicas do editor/Storage. */}
            <img
              alt={`Retrato de ${profile.name}`}
              className="size-full object-cover"
              src={profile.heroImage}
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              {profile.isVerified ? (
                <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-status-info/30 bg-status-infoBg px-4 text-sm font-bold text-status-info">
                  <BadgeCheck aria-hidden="true" size={16} />
                  Perfil verificado
                </span>
              ) : null}
              <span className="inline-flex min-h-9 items-center rounded-full border border-brand-lavender bg-white px-4 text-sm font-bold text-brand-deep">
                Atendimento online
              </span>
            </div>
            <h3 className="mt-3 font-display text-[36px] font-light italic leading-tight text-brand-deep sm:text-[46px]">
              {profile.name}
            </h3>
            <div className="mt-2 flex flex-wrap gap-3">
              {profile.tags.length ? (
                profile.tags.map((tag) => (
                  <span
                    className="font-display text-lg font-light italic text-status-info"
                    key={tag}
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-sm font-bold text-tesText-secondary">
                  Adicione caminhos de cuidado para enriquecer a prévia.
                </span>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-bold text-brand-deep">
              <span className="text-xl font-extrabold">
                {profile.rating.average?.toFixed(1) ?? "Novo"}
              </span>
              <span className="inline-flex text-status-warning">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star
                    aria-hidden="true"
                    className="size-4 fill-current"
                    key={index}
                  />
                ))}
              </span>
              <span>{profile.rating.count} avaliações</span>
            </div>
            <p className="mt-4 max-w-[520px] text-sm font-semibold leading-6 text-tesText-secondary">
              {profile.headline || "Sua apresentação aparecerá aqui."}
            </p>
          </div>
        </div>

        <div className="grid gap-4 p-4 pt-0 sm:p-6 sm:pt-0 lg:grid-cols-3">
          <PreviewCard title="Minha essência">
            {profile.content.essenceBody}
          </PreviewCard>
          <PreviewCard title="Como posso te guiar">
            {profile.content.guideItems.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {profile.content.guideItems.map((item) => (
                  <span
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-brand-lavender px-3 text-sm font-bold text-brand-deep"
                    key={item.label}
                  >
                    <Sparkles aria-hidden="true" size={16} />
                    {item.label}
                  </span>
                ))}
              </div>
            ) : (
              "Adicione itens para mostrar como você pode acompanhar a pessoa."
            )}
          </PreviewCard>
          <PreviewCard title="Um convite para você">
            {profile.video ? (
              <a
                className="relative grid aspect-video place-items-center overflow-hidden rounded-lg bg-brand-deep text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
                href={profile.video.url}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail pode ser mídia pública recém-enviada ao Storage. */}
                <img
                  alt={profile.video.title}
                  className="absolute inset-0 size-full object-cover opacity-70"
                  src={profile.video.thumbnailUrl}
                />
                <Play
                  aria-hidden="true"
                  className="relative z-10 size-11 fill-current"
                />
              </a>
            ) : (
              <span className="grid aspect-video place-items-center rounded-lg border border-dashed border-brand-lavender bg-brand-lavenderSoft p-4 text-center text-sm font-bold leading-6 text-brand-deep">
                Vídeo de apresentação indisponível no momento.
              </span>
            )}
          </PreviewCard>
        </div>

        <div className="grid gap-4 p-4 pt-0 sm:grid-cols-3 sm:p-6 sm:pt-0">
          <ReadOnlyPublicItem
            icon={<CalendarDays aria-hidden="true" size={18} />}
            label="Disponibilidade"
            value={
              profile.isAcceptingBookings
                ? "Pronta para reservas"
                : "Configuração pendente"
            }
          />
          <ReadOnlyPublicItem
            icon={<Heart aria-hidden="true" size={18} />}
            label="Sessões"
            value={`${profile.rating.sessionsCompleted} concluídas`}
          />
          <ReadOnlyPublicItem
            icon={<Sparkles aria-hidden="true" size={18} />}
            label="Terapias"
            value="Gerenciados em Suas terapias"
          />
        </div>
      </article>
    </ProfileSection>
  );
}

function PreviewCard({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-brand-lavender bg-white p-4">
      <h4 className="font-display text-2xl font-light italic text-status-info">
        {title}
      </h4>
      <div className="mt-3 text-sm font-semibold leading-6 text-tesText-primary">
        {children}
      </div>
    </section>
  );
}

function ReadOnlyPublicItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-brand-lavender bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-extrabold text-brand-deep">
        <span className="text-brand-primary">{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {value}
      </p>
    </div>
  );
}
