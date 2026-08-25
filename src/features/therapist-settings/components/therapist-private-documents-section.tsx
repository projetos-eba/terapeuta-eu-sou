"use client";

import { useEffect, useRef, useState } from "react";
import { FileBadge2, Loader2, MapPin, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import { TESButton, TESFeedbackDialog } from "@/components/tes";

import {
  uploadTherapistPrivateDocument,
  type TherapistPrivateDocumentKind,
} from "@/features/therapist-profile-editor/therapist-profile-editor.commands";
import type {
  TherapistPrivateDocumentSummary,
  TherapistProfileVerificationStatus,
} from "@/features/therapist-profile-editor/therapist-profile-editor.types";
import { ProfileSection } from "@/features/therapist-profile-editor/components/profile-section";

export const requiredPrivateDocuments: Array<{
  description: string;
  formats: string[];
  helper: string;
  kind: TherapistPrivateDocumentKind;
  title: string;
}> = [
  {
    description: "Envie um documento oficial com foto e boa legibilidade.",
    formats: ["PDF", "JPG", "PNG"],
    helper: "RG, CNH ou passaporte com foto",
    kind: "identity_document",
    title: "Documento de identidade",
  },
  {
    description: "Envie um comprovante recente, emitido nos últimos 90 dias.",
    formats: ["PDF", "JPG", "PNG"],
    helper: "Conta de luz, água, telefone ou documento equivalente",
    kind: "address_proof",
    title: "Comprovante de endereço",
  },
];

export function TherapistPrivateDocumentsSection({
  initialDocuments,
  initialVerificationStatus,
}: {
  initialDocuments: TherapistPrivateDocumentSummary[];
  initialVerificationStatus: TherapistProfileVerificationStatus;
}) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [verificationStatus, setVerificationStatus] = useState(
    initialVerificationStatus,
  );
  const [uploadingKind, setUploadingKind] =
    useState<TherapistPrivateDocumentKind | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    tone: "error" | "success";
  } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  useEffect(() => {
    setVerificationStatus(initialVerificationStatus);
  }, [initialVerificationStatus]);

  const documentsByKind = new Map(documents.map((item) => [item.kind, item]));
  const documentsComplete = requiredPrivateDocuments.every((item) => {
    const document = documentsByKind.get(item.kind);
    return Boolean(document && document.status !== "rejected");
  });

  async function handleUpload(kind: TherapistPrivateDocumentKind, file: File) {
    setUploadingKind(kind);
    setMessage(null);

    const result = await uploadTherapistPrivateDocument({ file, kind });
    setUploadingKind(null);

    if (result.status === "error") {
      setFeedback(result.error.message);
      return;
    }

    setDocuments(result.data.documents);
    setVerificationStatus(result.data.verificationStatus);
    setMessage({
      text: "Documento recebido. A equipe TES vai conferir as informações.",
      tone: "success",
    });
    router.refresh();
  }

  return (
    <ProfileSection
      description="O preenchimento dos dados e o envio destes documentos são necessários para a aprovação e publicação do seu perfil."
      title="Documentos para aprovação"
    >
      <div className="grid gap-4">
        <div className="rounded-[20px] border border-brand-lavender bg-brand-lavenderSoft p-4">
          <p className="text-sm font-extrabold leading-6 text-brand-deep">
            Seus documentos são privados
          </p>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            Eles são usados apenas pela equipe TES durante a análise e não
            aparecem no seu perfil público.
          </p>
        </div>

        <div aria-live="polite">
          {message?.tone === "success" ? (
            <p
              className="rounded-lg bg-status-successBg p-3 text-sm font-bold leading-6 text-status-success"
              role="status"
            >
              {message.text}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {requiredPrivateDocuments.map((documentConfig) => (
            <PrivateDocumentCard
              currentDocument={documentsByKind.get(documentConfig.kind)}
              key={documentConfig.kind}
              onUpload={(file) => void handleUpload(documentConfig.kind, file)}
              uploading={uploadingKind === documentConfig.kind}
              {...documentConfig}
            />
          ))}
        </div>

        <p className="text-sm font-semibold leading-6 text-tesText-secondary">
          {documentsComplete
            ? verificationStatus === "approved"
              ? "Os documentos desta etapa foram aprovados."
              : "Recebemos os documentos desta etapa. A equipe TES avisará você se precisar de algum ajuste."
            : "Falta enviar os documentos obrigatórios para continuarmos com a análise."}
        </p>
        {feedback ? (
          <TESFeedbackDialog
            message={feedback}
            onClose={() => setFeedback(null)}
          />
        ) : null}
      </div>
    </ProfileSection>
  );
}

function PrivateDocumentCard({
  currentDocument,
  description,
  formats,
  helper,
  kind,
  onUpload,
  title,
  uploading,
}: {
  currentDocument?: TherapistPrivateDocumentSummary;
  description: string;
  formats: string[];
  helper: string;
  kind: TherapistPrivateDocumentKind;
  onUpload: (file: File) => void;
  title: string;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="rounded-[24px] border border-border bg-white p-5">
      <input
        accept=".pdf,image/jpeg,image/png"
        className="sr-only"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) onUpload(file);
        }}
        ref={inputRef}
        type="file"
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-extrabold text-brand-deep">{title}</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            {description}
          </p>
        </div>
        <DocumentStatusPill document={currentDocument} />
      </div>

      <div className="mt-4 rounded-[20px] border border-dashed border-brand-lavender bg-surface-soft p-4">
        <p className="text-sm font-extrabold text-brand-deep">
          {currentDocument ? currentDocument.fileName : helper}
        </p>
        <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          {currentDocument
            ? `${formatFileSize(currentDocument.fileSizeBytes)} · ${formatValidationState(currentDocument.validationState)}`
            : helper}
        </p>
        {currentDocument?.reviewNote ? (
          <p className="mt-3 border-l-2 border-status-warning pl-3 text-sm font-semibold leading-6 text-tesText-secondary">
            {currentDocument.reviewNote}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {formats.map((format) => (
            <span
              className="rounded-full bg-brand-lavenderSoft px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-brand-primary sm:text-xs"
              key={format}
            >
              {format}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <TESButton
          className="min-h-11 rounded-lg"
          onClick={() => inputRef.current?.click()}
          type="button"
          variant={currentDocument ? "secondary" : "primary"}
        >
          {uploading ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Upload aria-hidden="true" className="size-4" />
          )}
          {uploading
            ? "Enviando..."
            : currentDocument
              ? "Substituir documento"
              : "Enviar documento"}
        </TESButton>
        {kind === "identity_document" ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-tesText-secondary">
            <FileBadge2 aria-hidden="true" className="size-4" />
            RG, CNH ou passaporte com foto
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm font-semibold text-tesText-secondary">
            <MapPin aria-hidden="true" className="size-4" />
            Emitido nos últimos 90 dias
          </p>
        )}
      </div>
    </div>
  );
}

function DocumentStatusPill({
  document,
}: {
  document?: TherapistPrivateDocumentSummary;
}) {
  const rejected = document?.status === "rejected";
  const classes = rejected
    ? "bg-status-dangerBg text-status-danger"
    : document
      ? "bg-status-successBg text-status-success"
      : "bg-status-warningBg text-status-warning";

  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full px-3 text-[11px] font-extrabold uppercase tracking-[0.08em] sm:text-xs ${classes}`}
    >
      {rejected ? "Novo envio" : document ? "Recebido" : "Falta enviar"}
    </span>
  );
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatValidationState(
  value: TherapistPrivateDocumentSummary["validationState"],
) {
  if (value === "passed") return "conferido";
  if (value === "pending") return "em conferência";
  if (value === "failed") return "precisa de revisão";
  return "recebido";
}
