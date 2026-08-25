"use client";

import { ImagePlus, Loader2, Play, Upload } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { TESButton, TESFeedbackDialog } from "@/components/tes";
import { TherapistPlan } from "@/domain/tes";
import {
  canAccessTherapistPlan,
  TherapistLockedCard,
} from "@/features/therapist-access";

import {
  type TherapistProfileMediaKind,
  uploadTherapistProfileMedia,
} from "../therapist-profile-editor.commands";
import type { TherapistProfileEditableFields } from "../therapist-profile-editor.types";
import { ProfileTextField } from "./profile-field-group";
import { ProfileSection } from "./profile-section";

const maxImageBytes = 5 * 1024 * 1024;
const maxVideoBytes = 5 * 1024 * 1024;

export function ProfilePhotoUploader({
  fields,
  updateField,
}: {
  fields: TherapistProfileEditableFields;
  updateField: <K extends keyof TherapistProfileEditableFields>(
    key: K,
    value: TherapistProfileEditableFields[K],
  ) => void;
}) {
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const previewUrl = localPreviewUrl ?? fields.photoUrl;

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  function showLocalPreview(file: File) {
    if (!file.type.startsWith("image/")) return;

    setLocalPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  }

  function saveUploadedPhoto(url: string) {
    setLocalPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    updateField("photoUrl", url);
  }

  return (
    <ProfileSection
      description="Use JPG, PNG ou WebP de até 5 MB. A foto aparece publicamente após publicação."
      title="Foto de perfil"
    >
      <div className="grid gap-4">
        {previewUrl ? (
          <div className="overflow-hidden rounded-card border border-border bg-surface-muted p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- prévia imediata de arquivo local ou URL pública recém-enviada. */}
            <img
              alt="Prévia da foto de perfil"
              className="aspect-square w-full rounded-lg object-cover"
              src={previewUrl}
            />
          </div>
        ) : (
          <div className="grid aspect-square place-items-center rounded-card border border-dashed border-border bg-surface-muted p-6 text-center text-sm font-semibold leading-6 text-tesText-secondary">
            A prévia da sua foto aparecerá aqui.
          </div>
        )}
        {localPreviewUrl ? (
          <p className="text-sm font-medium leading-6 text-tesText-secondary">
            Prévia local. A foto será salva após o envio e aparecerá
            publicamente somente depois da publicação.
          </p>
        ) : null}

        <MediaUploadControl
          accept="image/jpeg,image/png,image/webp"
          currentUrl={fields.photoUrl}
          kind="photo"
          label="Enviar foto de perfil"
          maxBytes={maxImageBytes}
          onFileSelected={showLocalPreview}
          onUploaded={saveUploadedPhoto}
        />
      </div>
    </ProfileSection>
  );
}

export function ProfileVideoUploader({
  canUploadVideo,
  fields,
  plan = TherapistPlan.PremiumPlus,
  updateField,
}: {
  canUploadVideo: boolean;
  fields: TherapistProfileEditableFields;
  plan?: TherapistPlan;
  updateField: <K extends keyof TherapistProfileEditableFields>(
    key: K,
    value: TherapistProfileEditableFields[K],
  ) => void;
}) {
  if (
    !canUploadVideo ||
    !canAccessTherapistPlan(plan, TherapistPlan.Premium)
  ) {
    return (
      <ProfileSection title="Vídeo de apresentação">
        <TherapistLockedCard
          description="Vídeo de apresentação está disponível para planos Premium e Premium Plus."
          requiredPlan={TherapistPlan.Premium}
          title="Vídeo de apresentação"
          variant="compact"
        />
      </ProfileSection>
    );
  }

  return (
    <ProfileSection
      description="Apresente-se em um conteúdo curto e responsável. Você pode enviar um vídeo de até 5 MB ou usar um link do YouTube ou Vimeo. Documentos privados não aparecem aqui."
      title="Vídeo de apresentação"
    >
      <div className="grid gap-4">
          <div className="relative aspect-video overflow-hidden rounded-lg border border-brand-lavender bg-brand-lavenderSoft">
            {fields.videoThumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview de URL pública recém-enviada ao Storage, sem remotePatterns estáticos.
              <img
                alt="Prévia do vídeo de apresentação"
                className="size-full object-cover"
                src={fields.videoThumbnailUrl}
              />
            ) : (
              <div className="grid size-full place-items-center text-center text-sm font-bold leading-6 text-brand-primary">
                <ImagePlus aria-hidden="true" className="mb-2 size-8" />
                Adicione uma capa para o vídeo
              </div>
            )}
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-14 place-items-center rounded-full bg-white/90 text-brand-primary shadow-card">
                <Play aria-hidden="true" className="ml-1 size-7 fill-current" />
              </span>
            </span>
          </div>

          <MediaUploadControl
            accept="video/mp4,video/webm,video/quicktime"
            currentUrl={fields.videoUrl}
            kind="video"
            label="Enviar novo vídeo"
            maxBytes={maxVideoBytes}
            onUploaded={(url) => {
              updateField("videoUrl", url);
              updateField("videoProvider", "upload");
            }}
          />
          <p className="text-sm font-semibold leading-6 text-tesText-secondary">
            Arquivos maiores que 5 MB precisam ser publicados no YouTube ou no
            Vimeo. Depois, cole o link abaixo para que o vídeo seja analisado
            pela equipe TES.
          </p>
          <MediaUploadControl
            accept="image/jpeg,image/png,image/webp"
            currentUrl={fields.videoThumbnailUrl}
            kind="video_thumbnail"
            label="Enviar capa do vídeo"
            maxBytes={maxImageBytes}
            onUploaded={(url) => updateField("videoThumbnailUrl", url)}
          />

          <div className="grid gap-4">
            <ProfileTextField
              id="videoUrl"
              label="Inserir link do vídeo"
              onChange={(value) => {
                updateField("videoUrl", value);
                updateField("videoProvider", videoProviderForUrl(value));
              }}
              placeholder="Cole um link do YouTube ou Vimeo"
              value={fields.videoUrl}
            />
            <ProfileTextField
              id="videoTitle"
              label="Título do vídeo"
              onChange={(value) => updateField("videoTitle", value)}
              value={fields.videoTitle}
            />
          </div>
      </div>
    </ProfileSection>
  );
}

function MediaUploadControl({
  accept,
  currentUrl,
  kind,
  label,
  maxBytes,
  onFileSelected,
  onUploaded,
}: {
  accept: string;
  currentUrl: string;
  kind: TherapistProfileMediaKind;
  label: string;
  maxBytes: number;
  onFileSelected?: (file: File) => void;
  onUploaded: (url: string) => void;
}) {
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (file.size > maxBytes) {
      setError(
        kind === "video"
          ? "O vídeo deve ter no máximo 5 MB. Para arquivos maiores, use um link do YouTube ou Vimeo."
          : "A imagem deve ter no máximo 5 MB.",
      );
      return;
    }

    onFileSelected?.(file);

    setUploading(true);
    const result = await uploadTherapistProfileMedia({ file, kind });
    setUploading(false);

    if (result.status === "error") {
      setError(result.error.message);
      return;
    }

    onUploaded(result.data.publicUrl);
  }

  return (
    <div className="grid gap-2">
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <input
        accept={accept}
        className="sr-only"
        disabled={uploading}
        id={inputId}
        onChange={(event) => void handleFile(event.target.files?.[0])}
        type="file"
      />
      <TESButton
        className="min-h-11 rounded-lg"
        disabled={uploading}
        onClick={() => document.getElementById(inputId)?.click()}
        type="button"
        variant="secondary"
      >
        {uploading ? (
          <Loader2 aria-hidden="true" className="animate-spin" size={18} />
        ) : (
          <Upload aria-hidden="true" size={18} />
        )}
        {label}
      </TESButton>
      {uploading ? (
        <div className="text-sm font-semibold leading-6 text-tesText-secondary">
          <progress className="mr-2 align-middle" />
          Enviando arquivo...
        </div>
      ) : null}
      {currentUrl ? (
        <p className="text-xs font-bold leading-5 text-tesText-subtle">
          Mídia atual preservada até novo envio válido.
        </p>
      ) : null}
      {error ? (
        <TESFeedbackDialog message={error} onClose={() => setError(null)} />
      ) : null}
    </div>
  );
}

function videoProviderForUrl(value: string): "external" | "youtube" | "vimeo" {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "external";

  try {
    const hostname = new URL(normalized).hostname.replace(/^www\./, "");
    if (hostname === "youtube.com" || hostname === "youtu.be") {
      return "youtube";
    }
    if (hostname === "vimeo.com") return "vimeo";
  } catch {
    return "external";
  }

  return "external";
}
