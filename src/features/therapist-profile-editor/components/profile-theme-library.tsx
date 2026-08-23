"use client";

import Image from "next/image";
import { Check, Crown, LockKeyhole, Sparkles } from "lucide-react";
import { useState } from "react";

import { TESButton, TESDialog } from "@/components/tes";
import {
  canUsePublicProfileTheme,
  profilePhotoShapeClassName,
  publicProfileThemes,
  type PublicProfileThemeDefinition,
} from "@/features/therapist-profile/personalization";
import { TherapistPlan } from "@/domain/tes";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

import type {
  TherapistProfileEditableFields,
  TherapistProfileEditorData,
  TherapistProfilePlan,
} from "../therapist-profile-editor.types";

export function ProfileThemeSummary({
  editor,
  fields,
  onOpen,
}: {
  editor: TherapistProfileEditorData;
  fields: TherapistProfileEditableFields;
  onOpen: () => void;
}) {
  const theme = publicProfileThemes.find(
    (candidate) => candidate.id === fields.publicProfileTheme,
  ) ?? publicProfileThemes[0];
  const plan = editor.derived.plan;
  const isDowngradePending =
    plan === "free" &&
    !canUsePublicProfileTheme(TherapistPlan.Free, theme);

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(180px,260px)_1fr] sm:items-center">
      <ProfileThemeCompositionPreview
        alt=""
        className="h-36 sm:h-40"
        fields={fields}
        theme={theme}
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-tesText-secondary">
          Visual do perfil
        </p>
        <h3 className="mt-1 text-lg font-extrabold text-brand-deep">
          {theme.label}
        </h3>
        <p className="mt-1 max-w-xl text-sm leading-6 text-tesText-secondary">
          {theme.description}
        </p>
        {isDowngradePending ? (
          <p className="mt-3 rounded-lg bg-status-warningBg px-3 py-2 text-sm font-bold leading-5 text-brand-deep">
            Este tema Premium ficará disponível novamente quando o plano for
            atualizado. Ao salvar no Free, o perfil volta para Sereno.
          </p>
        ) : null}
        <TESButton
          className="mt-4 w-full sm:w-auto"
          onClick={onOpen}
          type="button"
          variant="secondary"
        >
          Alterar tema
        </TESButton>
      </div>
    </div>
  );
}

export function ProfileThemeLibraryDialog({
  editor,
  fields,
  onClose,
  onLockedTheme,
  onSelect,
}: {
  editor: TherapistProfileEditorData;
  fields: TherapistProfileEditableFields;
  onClose: () => void;
  onLockedTheme: (theme: PublicProfileThemeDefinition) => void;
  onSelect: (themeId: TherapistProfileEditableFields["publicProfileTheme"]) => void;
}) {
  const [pendingThemeId, setPendingThemeId] = useState(fields.publicProfileTheme);
  const plan = editor.derived.plan;
  const selectedTheme = publicProfileThemes.find(
    (theme) => theme.id === pendingThemeId,
  );

  return (
    <TESDialog
      className="max-w-[1120px] rounded-none p-4 sm:rounded-[16px] sm:p-7"
      description="Veja a composição completa de cada opção. A escolha só será aplicada ao confirmar."
      onClose={onClose}
      title="Escolha o visual do seu perfil"
    >
      <div className="grid gap-8">
        {plan === "free" ? (
          <ThemeGroup
            fields={fields}
            onLockedTheme={onLockedTheme}
            onSelect={setPendingThemeId}
            plan={plan}
            selectedThemeId={pendingThemeId}
            themes={publicProfileThemes.filter((theme) => theme.tier === "free")}
            title="Disponíveis no seu plano"
          />
        ) : null}

        <ThemeGroup
          fields={fields}
          onLockedTheme={onLockedTheme}
          onSelect={setPendingThemeId}
          plan={plan}
          selectedThemeId={pendingThemeId}
          themes={
            plan === "free"
              ? publicProfileThemes.filter((theme) => theme.tier !== "free")
              : publicProfileThemes
          }
          title={plan === "free" ? "Temas Premium" : "Temas disponíveis"}
        />

        <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-col-reverse gap-3 border-t border-brand-lavender bg-white/95 px-4 pb-1 pt-4 backdrop-blur sm:-mx-7 sm:-mb-7 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:pb-7">
          <p className="text-sm font-semibold text-tesText-secondary">
            {selectedTheme ? `Selecionado: ${selectedTheme.label}` : "Escolha uma opção"}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <TESButton onClick={onClose} type="button" variant="ghost">
              Cancelar
            </TESButton>
            <TESButton
              disabled={
                !selectedTheme ||
                !canUsePublicProfileTheme(
                  planToDomainPlan(plan),
                  selectedTheme,
                )
              }
              onClick={() => {
                if (selectedTheme) onSelect(selectedTheme.id);
                onClose();
              }}
              type="button"
            >
              Aplicar tema
            </TESButton>
          </div>
        </div>
      </div>
    </TESDialog>
  );
}

function ThemeGroup({
  fields,
  onLockedTheme,
  onSelect,
  plan,
  selectedThemeId,
  themes,
  title,
}: {
  fields: TherapistProfileEditableFields;
  onLockedTheme: (theme: PublicProfileThemeDefinition) => void;
  onSelect: (themeId: TherapistProfileEditableFields["publicProfileTheme"]) => void;
  plan: TherapistProfilePlan;
  selectedThemeId: TherapistProfileEditableFields["publicProfileTheme"];
  themes: PublicProfileThemeDefinition[];
  title: string;
}) {
  return (
    <section aria-labelledby={`profile-theme-group-${title}`}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3
            className="text-base font-extrabold text-brand-deep"
            id={`profile-theme-group-${title}`}
          >
            {title}
          </h3>
          {title === "Temas Premium" ? (
            <p className="mt-1 text-sm font-semibold text-tesText-secondary">
              Explore as composições Premium mesmo no Free.
            </p>
          ) : null}
        </div>
        <span className="shrink-0 text-sm font-semibold text-tesText-secondary">
          {themes.length} {themes.length === 1 ? "tema" : "temas"}
        </span>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {themes.map((theme) => {
          const selected = selectedThemeId === theme.id;
          const available = canUsePublicProfileTheme(
            planToDomainPlan(plan),
            theme,
          );

          return (
            <button
              aria-pressed={selected}
              className={cn(
                "group min-w-0 rounded-card border bg-white p-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary",
                selected
                  ? "border-brand-primary shadow-card"
                  : "border-border hover:border-brand-lavender hover:shadow-card",
              )}
              key={theme.id}
              onClick={() => {
                if (available) onSelect(theme.id);
                else onLockedTheme(theme);
              }}
              type="button"
            >
              <ProfileThemeCompositionPreview
                alt={`Prévia do tema ${theme.label}`}
                fields={fields}
                theme={theme}
              />
              <div className="flex items-start justify-between gap-2 px-1 pb-1 pt-3">
                <span className="min-w-0 text-sm font-extrabold leading-5 text-brand-deep">
                  {theme.label}
                </span>
                {selected ? (
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-primary text-white">
                    <Check aria-hidden="true" size={16} />
                  </span>
                ) : null}
              </div>
              <div className="flex min-h-7 items-center justify-between gap-2 px-1 pb-1">
                {theme.tier !== "free" ? (
                  <span className="inline-flex min-h-7 items-center gap-1 rounded-full bg-brand-lavenderSoft px-2.5 text-xs font-extrabold text-brand-primary">
                    <Crown aria-hidden="true" size={13} />
                    Premium
                  </span>
                ) : (
                  <span className="text-xs font-bold text-tesText-secondary">
                    Incluído no Free
                  </span>
                )}
                {!available ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-tesText-secondary">
                    <LockKeyhole aria-hidden="true" size={13} />
                    Bloqueado
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function ProfileThemeUpsellDialog({
  onContinue,
  onClose,
}: {
  onContinue: () => void;
  onClose: () => void;
}) {
  return (
    <TESDialog
      className="max-w-[520px]"
      description="Desbloqueie temas especiais para apresentar seu trabalho do seu jeito."
      onClose={onClose}
      title="Visual exclusivo do Premium"
    >
      <div className="grid gap-5">
        <div className="grid size-12 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Sparkles aria-hidden="true" size={22} />
        </div>
        <p className="text-sm font-semibold leading-6 text-tesText-primary">
          Conheça composições completas com background, recorte e identidade
          visual pensados para o seu perfil.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <TESButton onClick={onContinue} type="button" variant="ghost">
            Continuar explorando
          </TESButton>
          <TESButton href={routes.therapist.plan}>Conhecer Premium</TESButton>
        </div>
      </div>
    </TESDialog>
  );
}

export function ProfileThemeCompositionPreview({
  alt,
  className,
  fields,
  theme,
}: {
  alt: string;
  className?: string;
  fields: TherapistProfileEditableFields;
  theme: PublicProfileThemeDefinition;
}) {
  const backgroundAsset = theme.backgroundAsset ?? theme.heroBackgroundSrc;
  const [assetState, setAssetState] = useState<"error" | "loading" | "loaded">(
    backgroundAsset ? "loading" : "loaded",
  );
  const photoSrc = fields.photoUrl || "/icon.svg";

  return (
    <div
      className={cn(
        "relative isolate min-h-28 overflow-hidden rounded-lg border border-border bg-[var(--profile-hero-background)]",
        className,
      )}
      data-theme-preview={theme.id}
      style={theme.style}
    >
      {backgroundAsset ? (
        <Image
          alt={alt}
          aria-hidden={alt === ""}
          className={cn(
            "absolute inset-0 size-full object-cover object-center transition-opacity",
            assetState === "loaded" ? "opacity-100" : "opacity-0",
          )}
          fill
          onError={() => setAssetState("error")}
          onLoad={() => setAssetState("loaded")}
          sizes="(min-width: 1024px) 240px, (min-width: 640px) 45vw, 100vw"
          src={backgroundAsset}
        />
      ) : null}
      {assetState === "loading" ? (
        <div
          aria-label="Carregando prévia"
          className="absolute inset-0 animate-pulse bg-brand-lavenderSoft"
          role="status"
        />
      ) : null}
      {assetState === "error" ? (
        <div className="absolute inset-0 grid place-items-center bg-surface-mist p-3 text-center text-xs font-bold text-tesText-secondary">
          Prévia indisponível
        </div>
      ) : null}

      <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-brand-deep/10" />
      <div className="absolute bottom-[12%] left-[9%] z-10 w-[31%] min-w-14 max-w-24">
        <div
          className={cn(
            "relative aspect-[4/5] overflow-hidden border-2 border-white bg-brand-lavenderSoft shadow-card",
            profilePhotoShapeClassName(theme.photoShape),
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a foto do editor pode vir de uma URL pública dinâmica. */}
          <img alt="" className="size-full object-cover" src={photoSrc} />
        </div>
      </div>
      <div className="absolute bottom-[18%] left-[46%] z-10 max-w-[46%]">
        <div className="h-2 w-24 max-w-full rounded-full bg-brand-deep/75" />
        <div className="mt-2 h-1.5 w-16 max-w-full rounded-full bg-brand-primary/75" />
      </div>
    </div>
  );
}

function planToDomainPlan(plan: TherapistProfilePlan): TherapistPlan {
  return plan;
}
