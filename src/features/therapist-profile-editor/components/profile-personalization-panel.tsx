"use client";

import { Link2, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { TESButton } from "@/components/tes";
import { TherapistPlan } from "@/domain/tes";
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
import {
  ProfileThemeLibraryDialog,
  ProfileThemeSummary,
  ProfileThemeUpsellDialog,
} from "./profile-theme-library";

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
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isUpsellOpen, setIsUpsellOpen] = useState(false);

  return (
    <ProfileSection className="grid gap-8" title="Identidade da página pública">
      <fieldset>
        <legend className="text-base font-extrabold text-brand-deep">
          Tema do perfil
        </legend>
        <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          Escolha uma composição que combine com a forma como você quer
          apresentar seu trabalho.
        </p>
        <div className="mt-4">
          <ProfileThemeSummary
            editor={editor}
            fields={fields}
            onOpen={() => setIsLibraryOpen(true)}
          />
        </div>
      </fieldset>

      {isLibraryOpen ? (
        <ProfileThemeLibraryDialog
          editor={editor}
          fields={fields}
          onClose={() => setIsLibraryOpen(false)}
          onLockedTheme={() => {
            setIsLibraryOpen(false);
            setIsUpsellOpen(true);
          }}
          onSelect={(themeId) => {
            updateField("publicProfileTheme", themeId);
            onMessage("Tema selecionado. Salve as alterações para publicar.");
          }}
        />
      ) : null}

      {isUpsellOpen ? (
        <ProfileThemeUpsellDialog
          onClose={() => setIsUpsellOpen(false)}
          onContinue={() => {
            setIsUpsellOpen(false);
            setIsLibraryOpen(true);
          }}
        />
      ) : null}

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
            requiredPlan={TherapistPlan.Premium}
            title="Link personalizado"
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
