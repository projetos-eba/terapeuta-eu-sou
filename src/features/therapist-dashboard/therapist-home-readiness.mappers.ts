import { TherapistStatus } from "@/domain/tes";
import type { TherapistConnectAccount } from "@/features/therapist-finance/therapist-finance.types";
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
  session: Pick<
    AuthenticatedTherapistSession,
    "plan" | "profileId" | "status"
  >;
}): TherapistHomeReadiness {
  if (editor.therapistProfileId !== session.profileId) {
    throw new Error("therapist_home_profile_mismatch");
  }

  const checklist = [
    profileItem(editor),
    servicesItem(editor),
    agendaItem(editor),
    connectItem(connect),
  ];
  const requiredItems = checklist.filter((item) => item.required);
  const requiredCount = requiredItems.length;
  const completedRequiredCount = requiredItems.filter((item) => item.complete)
    .length;

  return {
    checklist,
    completedRequiredCount,
    documents: documentItems(editor),
    isOperationallyReady: completedRequiredCount === requiredCount,
    plan: session.plan,
    profileCompleteness: editor.completeness.percent,
    profileSummary: {
      city: editor.draft?.fields.city ?? editor.published.fields.city,
      headline: editor.draft?.fields.headline ?? editor.published.fields.headline,
      publicName:
        editor.draft?.fields.publicName ?? editor.published.fields.publicName,
      state: editor.draft?.fields.state ?? editor.published.fields.state,
    },
    profilePublicStatus: editor.derived.publicStatus,
    requiredCount,
    therapistStatus: session.status,
    verificationStatus:
      editor.verificationSummary?.status ?? editor.derived.verificationStatus,
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
): TherapistHomeChecklistItem {
  const complete = editor.derived.publicStatus === "published";

  return {
    actionLabel: complete ? "Ver perfil" : "Publicar perfil",
    complete,
    description: complete
      ? "Seu perfil público já tem uma versão publicada."
      : "Publique sua apresentação pública, texto curto e essência.",
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
      ? `${editor.derived.availabilityRuleCount} regra(s) de horário ativa(s).`
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
      required: false,
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
      required: false,
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
      required: false,
      state: "complete",
      title: "Conta de recebimento",
    };
  }

  return {
    actionLabel: "Sincronizar status",
    complete: true,
    description:
      "Dados enviados. A análise pode continuar em andamento.",
    href: `${routes.therapist.finance}?tab=conta`,
    id: "connect",
    required: false,
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
