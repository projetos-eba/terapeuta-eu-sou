import type { ReactNode } from "react";
import {
  BadgeCheck,
  CalendarDays,
  Heart,
  Play,
  Sparkles,
  Star,
} from "lucide-react";

import {
  MAX_THERAPIST_PROFILE_GUIDE_ITEMS,
  type PublicTherapistProfile,
} from "@/features/therapist-profile/types";
import {
  profilePhotoShapeClassName,
  publicProfileThemeById,
} from "@/features/therapist-profile/personalization";

import { ProfileSection } from "./profile-section";

export function PublicProfileSnapshot({
  profile,
}: {
  profile: PublicTherapistProfile;
}) {
  const theme = publicProfileThemeById[profile.publicProfileTheme];

  return (
    <ProfileSection className="overflow-hidden p-0" title="Preview do perfil">
      <article
        className="bg-[linear-gradient(180deg,var(--tes-color-surface-default)_0%,var(--tes-color-surface-soft)_100%)]"
        data-profile-theme={theme.id}
        style={theme.style}
      >
        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(220px,0.42fr)_minmax(0,1fr)]">
          <div
            className={`relative aspect-[4/5] overflow-hidden bg-brand-lavenderSoft ${profilePhotoShapeClassName(theme.photoShape)}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- preview usa URL pública já autorizada do perfil. */}
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

            <h2 className="mt-3 font-display text-[36px] font-light italic leading-tight text-brand-deep sm:text-[46px]">
              {profile.name}
            </h2>

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
                  Suas terapias aparecerão aqui quando estiverem ativas.
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

            <p className="mt-4 max-w-[560px] text-sm font-semibold leading-6 text-tesText-secondary">
              {profile.headline || "Sua apresentação aparecerá aqui."}
            </p>
          </div>
        </div>

        <div className="grid gap-4 p-4 pt-0 sm:p-6 sm:pt-0 lg:grid-cols-3">
          <SnapshotCard title="Minha essência">
            {profile.content.essenceBody}
          </SnapshotCard>
          <SnapshotCard title="Como posso te guiar">
            {profile.content.guideItems.length ? (
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3">
                {profile.content.guideItems
                  .slice(0, MAX_THERAPIST_PROFILE_GUIDE_ITEMS)
                  .map((item) => (
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
          </SnapshotCard>
          <SnapshotCard title="Um convite para você">
            {profile.video ? (
              <a
                className="relative grid aspect-video place-items-center overflow-hidden rounded-lg bg-brand-deep text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
                href={profile.video.url}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail vem de mídia pública do perfil. */}
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
          </SnapshotCard>
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
            value="Organizadas em Suas terapias"
          />
        </div>
      </article>
    </ProfileSection>
  );
}

function SnapshotCard({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-brand-lavender bg-white p-4">
      <h3 className="font-display text-2xl font-light italic text-status-info">
        {title}
      </h3>
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
