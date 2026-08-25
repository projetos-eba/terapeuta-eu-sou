import { TherapistStatus } from "@/domain/tes";
import type { TherapistConnectAccount } from "@/features/therapist-finance/therapist-finance.types";
import { getTherapistProfileReviewReason } from "@/features/therapist-profile-editor/therapist-profile-editor.mappers";
import type { TherapistProfileEditorData } from "@/features/therapist-profile-editor/therapist-profile-editor.types";
import type { AuthenticatedTherapistSession } from "@/lib/auth/therapist-session";
import { routes } from "@/lib/routes";

import type {
  TherapistHomeChecklistItem,
  TherapistHomeDocument,
  TherapistHomeReadiness,
} from "./therapist-home-readiness.types";

export function mapTherapistHomeReadiness({
  connect,
  editor,
  session,
}: {
  connect: TherapistConnectAccount | null;
  editor: TherapistProfileEditorData;
  session: Pick<AuthenticatedTherapistSession, "plan" | "profileId" | "status">;
}): TherapistHomeReadiness {
  if (editor.therapistProfileId !== session.profileId) {
    throw new Error("therapist_home_profile_mismatch");
  }

  const verificationStatus =
    editor.verificationSummary?.status ?? editor.derived.verificationStatus;
  const checklist = [
    profileItem(editor, verificationStatus),
    servicesItem(editor),
    agendaItem(editor),
    connectItem(connect),
  ];
  const requiredItems = checklist.filter((item) => item.required);
  const documents = documentItems(editor);
  const requiredCount = requiredItems.length + documents.length;
  const completedRequiredCount =
    requiredItems.filter((item) => item.complete).length +
    documents.filter((item) => item.complete).length;

  return {
    checklist,
    completedRequiredCount,
    documents,
    isOperationallyReady: completedRequiredCount === requiredCount,
    plan: session.plan,
    profileCompleteness: editor.completeness.percent,
    profileSummary: {
      city: editor.draft?.fields.city ?? editor.published.fields.city,
      headline:
        editor.draft?.fields.headline ?? editor.published.fields.headline,
      publicName:
        editor.draft?.fields.publicName ?? editor.published.fields.publicName,
      state: editor.draft?.fields.state ?? editor.published.fields.state,
    },
    profilePublicStatus: editor.derived.publicStatus,
    requiredCount,
    therapistStatus: session.status,
    verificationStatus,
  };
}

function documentItems(
  editor: TherapistProfileEditorData,
): TherapistHomeDocument[] {
  const documents = new Map(
    editor.privateDocuments.map((document) => [document.kind, document]),
  );

  return [
    documentItem({
      description: "Envie um documento oficial com foto.",
      document: documents.get("identity_document"),
      id: "identity_document",
      title: "Documento de identidade",
    }),
    documentItem({
      description: "Envie um comprovante emitido nos últimos 90 dias.",
      document: documents.get("address_proof"),
      id: "address_proof",
      title: "Comprovante de endereço",
    }),
  ];
}

function documentItem({
  description,
  document,
  id,
  title,
}: {
  description: string;
  document: TherapistProfileEditorData["privateDocuments"][number] | undefined;
  id: TherapistHomeDocument["id"];
  title: string;
}): TherapistHomeDocument {
  if (document?.status === "rejected") {
    return { complete: false, description, id, state: "attention", title };
  }

  if (document) {
    return { complete: true, description, id, state: "complete", title };
  }

  return { complete: false, description, id, state: "pending", title };
}

function profileItem(
  editor: TherapistProfileEditorData,
  verificationStatus: TherapistProfileEditorData["derived"]["verificationStatus"],
): TherapistHomeChecklistItem {
  const needsCorrections =
    verificationStatus === "changes_requested" ||
    verificationStatus === "rejected";
  const inReview = ["submitted", "in_review"].includes(verificationStatus);
  const complete =
    editor.derived.publicStatus === "published" && !needsCorrections;

  if (needsCorrections) {
    return {
      actionLabel: "Ver correções",
      complete: false,
      description: getTherapistProfileReviewReason(editor)
        ? "A equipe TES pediu correções no seu perfil. Abra para ver a justificativa."
        : "A equipe TES pediu correções no seu perfil antes de uma nova análise.",
      href: routes.therapist.profile,
      id: "profile",
      required: true,
      state: "attention",
      title: "Perfil público",
    };
  }

  if (inReview) {
    return {
      actionLabel: "Acompanhar análise",
      complete: true,
      description:
        verificationStatus === "in_review"
          ? "Seu perfil público está em análise pela equipe TES."
          : "Seu perfil foi enviado e aguarda o início da análise da equipe TES.",
      href: routes.therapist.profile,
      id: "profile",
      required: true,
      state: "in_review",
      title: "Perfil público",
    };
  }

  return {
    actionLabel: complete ? "Ver perfil" : "Publicar perfil",
    complete,
    description: complete
      ? "Seu perfil público já está publicado e visível para as pessoas."
      : "Complete sua apresentação e envie seus dados e documentos em Configurações.",
    href: complete ? routes.therapist.profile : routes.therapist.profileEdit,
    id: "profile",
    required: true,
    state: complete ? "complete" : "pending",
    title: "Perfil público",
  };
}

function servicesItem(
  editor: TherapistProfileEditorData,
): TherapistHomeChecklistItem {
  const complete = editor.derived.activeServiceCount > 0;

  return {
    actionLabel: complete ? "Ver terapias" : "Gerenciar terapias",
    complete,
    description: complete
      ? `${editor.derived.activeServiceCount} terapia(s) ativa(s) para reserva online.`
      : "Cadastre ao menos uma terapia ativa, online, reservável e com preço.",
    href: routes.therapist.services,
    id: "services",
    required: true,
    state: complete ? "complete" : "pending",
    title: "Terapias ativas",
  };
}

function agendaItem(
  editor: TherapistProfileEditorData,
): TherapistHomeChecklistItem {
  const complete = editor.derived.availabilityRuleCount > 0;

  return {
    actionLabel: complete ? "Ver agenda" : "Abrir agenda",
    complete,
    description: complete
      ? `${editor.derived.availabilityRuleCount} período(s) de atendimento configurado(s).`
      : "Configure horários recorrentes para que reservas possam aparecer.",
    href: routes.therapist.agenda,
    id: "agenda",
    required: true,
    state: complete ? "complete" : "pending",
    title: "Agenda disponível",
  };
}

function connectItem(
  connect: TherapistConnectAccount | null,
): TherapistHomeChecklistItem {
  if (!connect?.accountExists) {
    return {
      actionLabel: "Conectar conta",
      complete: false,
      description:
        "Conecte sua conta de recebimento para preparar os repasses das sessões.",
      href: `${routes.therapist.finance}?tab=conta`,
      id: "connect",
      required: true,
      state: "pending",
      title: "Conta de recebimento",
    };
  }

  if (
    !connect.detailsSubmitted ||
    connect.onboardingStatus === "account_created" ||
    connect.onboardingStatus === "not_started"
  ) {
    return {
      actionLabel: "Continuar cadastro",
      complete: false,
      description:
        "Conclua o cadastro da sua conta de recebimento antes de começar a atender.",
      href: `${routes.therapist.finance}?tab=conta`,
      id: "connect",
      required: true,
      state: "pending",
      title: "Conta de recebimento",
    };
  }

  if (
    connect.onboardingStatus === "requirements_due" ||
    connect.onboardingStatus === "restricted" ||
    connect.onboardingStatus === "disabled"
  ) {
    return {
      actionLabel: "Atualizar dados",
      complete: false,
      description:
        "Precisamos de algumas informações adicionais antes de liberar repasses.",
      href: `${routes.therapist.finance}?tab=conta`,
      id: "connect",
      required: true,
      state: "attention",
      title: "Conta de recebimento",
    };
  }

  if (
    connect.onboardingStatus === "ready" &&
    connect.transferCapabilityStatus === "active"
  ) {
    return {
      actionLabel: "Ver financeiro",
      complete: true,
      description: "Sua conta está pronta para receber repasses elegíveis.",
      href: `${routes.therapist.finance}?tab=conta`,
      id: "connect",
      required: true,
      state: "complete",
      title: "Conta de recebimento",
    };
  }

  return {
    actionLabel: "Acompanhar análise",
    complete: true,
    description:
      "Seus dados foram enviados e a análise pode continuar em andamento.",
    href: `${routes.therapist.finance}?tab=conta`,
    id: "connect",
    required: true,
    state: "in_review",
    title: "Conta de recebimento",
  };
}

export function therapistStatusLabel(status: TherapistStatus) {
  if (status === TherapistStatus.Approved) return "Aprovado";
  if (status === TherapistStatus.Submitted) return "Enviado para revisão";
  if (status === TherapistStatus.InReview) return "Em revisão";
  if (status === TherapistStatus.ChangesRequested) return "Ajustes solicitados";
  return "Em rascunho";
}
