"use client";

import Image from "next/image";
import { Check, Link2, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { TESButton } from "@/components/tes";
import { publicProfileThemes } from "@/features/therapist-profile/personalization";
import { cn } from "@/lib/utils";

import {
  createStableRequestId,
  sendTherapistProfileCommand,
} from "../therapist-profile-editor.commands";
import type {
  TherapistProfileEditableFields,
  TherapistProfileEditorData,
  TherapistProfileMutationResult,
  TherapistProfileSlugAvailabilityResult,
} from "../therapist-profile-editor.types";
import { ProfileCapabilityGate } from "./profile-capability-gate";
import { ProfileSection } from "./profile-section";

export function ProfilePersonalizationPanel({
  editor,
  fields,
  onEditorChange,
  onError,
  onMessage,
  updateField,
}: {
  editor: TherapistProfileEditorData;
  fields: TherapistProfileEditableFields;
  onEditorChange: (editor: TherapistProfileEditorData) => void;
  onError: (message: string | null) => void;
  onMessage: (message: string) => void;
  updateField: <K extends keyof TherapistProfileEditableFields>(
    key: K,
    value: TherapistProfileEditableFields[K],
  ) => void;
}) {
  return (
    <ProfileSection className="grid gap-8" title="Identidade da página pública">
      <fieldset>
        <legend className="text-base font-extrabold text-brand-deep">
          Tema da página pública
        </legend>
        <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          O tema altera somente o cabeçalho do seu perfil. O restante da página
          continua com a identidade TES.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {publicProfileThemes.map((theme) => {
            const selected = fields.publicProfileTheme === theme.id;
            const current = editor.publicProfileTheme === theme.id;
            return (
              <label
                className={cn(
                  "relative cursor-pointer rounded-card border bg-white p-3 transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-primary",
                  selected
                    ? "border-brand-primary shadow-card"
                    : "border-border hover:border-brand-lavender",
                )}
                key={theme.id}
              >
                <input
                  checked={selected}
                  className="sr-only"
                  name="public-profile-theme"
                  onChange={() => updateField("publicProfileTheme", theme.id)}
                  type="radio"
                  value={theme.id}
                />
                <div
                  className="relative h-24 overflow-hidden rounded-lg border border-border"
                  data-theme-preview={theme.id}
                  style={theme.style}
                >
                  {theme.heroBackgroundSrc ? (
                    <Image
                      alt=""
                      aria-hidden="true"
                      className="object-cover object-center"
                      data-theme-preview-background={theme.id}
                      fill
                      sizes="(min-width: 640px) 50vw, 100vw"
                      src={theme.heroBackgroundSrc}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[var(--profile-hero-background)]" />
                  )}
                  {theme.heroIllustrationSrc ? (
                    <Image
                      alt=""
                      aria-hidden="true"
                      className="pointer-events-none absolute -bottom-7 -right-2 object-contain opacity-50"
                      data-theme-preview-illustration={theme.id}
                      fill
                      sizes="180px"
                      src={theme.heroIllustrationSrc}
                    />
                  ) : (
                    <div className="absolute -right-5 -top-7 size-24 rounded-full bg-[var(--profile-shape)] opacity-70" />
                  )}
                  <div className="absolute bottom-4 left-4 h-2 w-24 rounded-full bg-brand-deep" />
                  <div className="absolute bottom-8 left-4 h-1.5 w-16 rounded-full bg-[var(--profile-accent)]" />
                </div>
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div>
                    <span className="text-sm font-extrabold text-brand-deep">
                      {theme.label}
                    </span>
                    <p className="mt-1 text-sm leading-5 text-tesText-secondary">
                      {theme.description}
                    </p>
                    <div className="mt-3 flex gap-1.5" aria-hidden="true">
                      {theme.palette.map((color) => (
                        <span
                          className={cn(
                            "size-4 rounded-full border border-border",
                            color,
                          )}
                          key={color}
                        />
                      ))}
                    </div>
                  </div>
                  {selected ? (
                    <Check className="size-5 shrink-0 text-brand-primary" />
                  ) : null}
                </div>
                {current ? (
                  <span className="mt-3 inline-flex rounded-full bg-brand-lavenderSoft px-3 py-1 text-xs font-bold text-brand-primary">
                    Tema atual
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      <SlugEditor
        editor={editor}
        onEditorChange={onEditorChange}
        onError={onError}
        onMessage={onMessage}
      />
    </ProfileSection>
  );
}

function SlugEditor({
  editor,
  onEditorChange,
  onError,
  onMessage,
}: {
  editor: TherapistProfileEditorData;
  onEditorChange: (editor: TherapistProfileEditorData) => void;
  onError: (message: string | null) => void;
  onMessage: (message: string) => void;
}) {
  const [slug, setSlug] = useState(editor.publicProfileSlug);
  const [availability, setAvailability] =
    useState<TherapistProfileSlugAvailabilityResult>({
      normalizedSlug: editor.publicProfileSlug,
      status: "current",
    });
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const allowed = editor.capabilities.canCustomizePublicSlug;

  useEffect(() => {
    if (!allowed || slug.trim() === editor.publicProfileSlug) {
      setAvailability({
        normalizedSlug: editor.publicProfileSlug,
        status: "current",
      });
      setChecking(false);
      return;
    }

    let active = true;
    setChecking(true);
    const timeout = window.setTimeout(async () => {
      const result = await sendTherapistProfileCommand({
        action: "check_slug_availability",
        slug,
      });
      if (!active) return;
      setChecking(false);
      if (result.status === "error") {
        setAvailability({ normalizedSlug: slug, status: "invalid" });
        return;
      }
      setAvailability(result.data as TherapistProfileSlugAvailabilityResult);
    }, 450);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [allowed, editor.publicProfileSlug, slug]);

  async function saveSlug() {
    setSaving(true);
    onError(null);
    const result = await sendTherapistProfileCommand({
      action: "update_slug",
      expectedVersion: editor.version,
      requestId: createStableRequestId(),
      slug,
    });
    setSaving(false);
    if (result.status === "error") {
      onError(result.error.message);
      onMessage(result.error.message);
      return;
    }
    const mutation = result.data as TherapistProfileMutationResult;
    onEditorChange(mutation.editor);
    setSlug(mutation.editor.publicProfileSlug);
    setAvailability({
      normalizedSlug: mutation.editor.publicProfileSlug,
      status: "current",
    });
    onMessage("Link do perfil atualizado.");
  }

  const statusMessage = slugStatusMessage(availability.status, checking);
  const canSave =
    allowed && !checking && !saving && availability.status === "available";

  return (
    <div className="border-t border-border pt-8">
      <div className="flex items-center gap-2">
        <Link2 aria-hidden="true" className="size-5 text-brand-primary" />
        <h3 className="text-base font-extrabold text-brand-deep">
          Link do seu perfil
        </h3>
      </div>
      <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
        A alteração entra em vigor imediatamente. Endereços anteriores seguem
        redirecionando para o perfil atual.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label
          className="block text-sm font-bold text-brand-deep"
          htmlFor="publicProfileSlug"
        >
          Endereço público
          <span className="mt-2 flex min-h-12 overflow-hidden rounded-lg border border-border bg-white focus-within:border-brand-primary focus-within:ring-4 focus-within:ring-brand-primary/10">
            <span className="hidden items-center bg-brand-lavenderSoft px-3 text-sm text-tesText-secondary md:flex">
              /terapeutas/
            </span>
            <input
              aria-describedby="publicProfileSlug-status"
              className="min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-brand-deep outline-none disabled:cursor-not-allowed disabled:bg-surface-mist"
              disabled={!allowed || saving}
              id="publicProfileSlug"
              maxLength={120}
              onChange={(event) => setSlug(event.target.value)}
              value={slug}
            />
          </span>
        </label>
        <TESButton
          className="min-h-12"
          disabled={!canSave}
          onClick={() => void saveSlug()}
          type="button"
        >
          {saving ? (
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
          ) : null}
          Salvar link
        </TESButton>
      </div>
      <p
        className={cn(
          "mt-2 min-h-5 text-sm font-semibold",
          availability.status === "available" ||
            availability.status === "current"
            ? "text-status-success"
            : "text-status-danger",
        )}
        id="publicProfileSlug-status"
      >
        {statusMessage}
        {availability.normalizedSlug && availability.normalizedSlug !== slug
          ? ` Prévia: /terapeutas/${availability.normalizedSlug}`
          : ""}
      </p>
      {!allowed ? (
        <div className="mt-4">
          <ProfileCapabilityGate
            allowed={false}
            message="O link personalizado está disponível nos planos Premium e Premium Plus. Seu identificador numérico continua estável e compartilhável."
          >
            {null}
          </ProfileCapabilityGate>
        </div>
      ) : null}
    </div>
  );
}

function slugStatusMessage(
  status: TherapistProfileSlugAvailabilityResult["status"],
  checking: boolean,
) {
  if (checking) return "Verificando disponibilidade…";
  if (status === "available") return "Este link está disponível.";
  if (status === "current") return "Este é o link atual do seu perfil.";
  if (status === "taken") return "Este link não está disponível.";
  if (status === "reserved")
    return "Este endereço é reservado pela plataforma.";
  return "Use de 3 a 40 caracteres para criar seu link.";
}
