import { createRoot } from "react-dom/client";
import TherapistSessionDetailPage from "../../../src/app/(therapist)/terapeuta/sessoes/[bookingId]/page";
import { AdminSessionDetailPage } from "../../../src/features/admin-operations/components/admin-session-detail-page";
import type { AdminOperationDetailPageData } from "../../../src/features/admin-operations/admin-operations.types";
import { ZoomWaitingRoom } from "../../../src/features/zoom/components/zoom-waiting-room";
import { SessionFeedbackForm } from "../../../src/features/session-feedback/components/session-feedback-form";
import { SessionQualityStatus } from "../../../src/features/session-feedback/components/session-quality-status";
import "../../../src/app/globals.css";

async function main() {
  const role = new URLSearchParams(location.search).get("role");
  const root = createRoot(document.getElementById("root")!);
  if (role === "quality-state-patient" || role === "quality-state-therapist") {
    const stage = new URLSearchParams(location.search).get("stage");
    root.render(
      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        <SessionQualityStatus
          actorRole={role === "quality-state-patient" ? "patient" : "therapist"}
          payload={{
            realizationStatus: "performed",
            status: "eligible",
            feedback: null,
            confirmation: null,
            actorConfirmation: null,
            supportTicketId: "own-private-ticket",
            qualityReview: {
              isOpen: stage !== "answered",
              allAnswered: stage === "answered",
              overdue: stage === "overdue",
              automaticConfirmationPaused: stage === "open",
              dueAt: null,
            },
          }}
        />
      </main>,
    );
    return;
  }
  if (role === "quality-patient" || role === "quality-therapist") {
    root.render(
      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        <SessionFeedbackForm
          actorRole={role === "quality-patient" ? "patient" : "therapist"}
          bookingId="fixture"
          publicReviewTherapist={
            role === "quality-patient"
              ? { id: "therapist-fixture", name: "Terapeuta de teste" }
              : undefined
          }
          sessionLabel="Sessão de teste"
        />
      </main>,
    );
    return;
  }
  if (role === "therapist") {
    root.render(
      await TherapistSessionDetailPage({
        params: Promise.resolve({ bookingId: "fixture" }),
      }),
    );
    return;
  }
  if (role === "admin" || role === "quality-admin") {
    const data: AdminOperationDetailPageData = {
      auditEvents: [],
      backHref: "/admin/sessoes",
      generatedAt: "2026-09-16T21:23:00Z",
      id: "fixture",
      module: "sessions",
      safetyNotes: [],
      statusLabel: "no_show_therapist",
      subtitle: "Acompanhe agenda, presença e análise.",
      title: "Reiki online",
      sections: [
        { title: "Sessão", fields: [{ label: "Pagamento", value: "paid" }] },
        {
          title: "Sala online",
          fields: [{ label: "Situação da sala", value: "Pronta para iniciar" }],
        },
      ],
      sessionFeedback: {
        status: "available",
        data: {
          attendance: {
            bothJoined: false,
            classification: "no_show_therapist",
            classificationSource: "authenticated_waiting_room",
            financialResolution: "pending",
            incidentId: "fixture",
            patientArrivedAt: "2026-09-16T21:01:00Z",
            patientJoined: false,
            patientJoinedAt: null,
            patientPresentAtTolerance: true,
            processingCostRecoveryAuthorized: false,
            resolution: null,
            responsibility: "unassigned",
            retentionAuthorized: false,
            reviewDueAt: null,
            sessionClosed: true,
            sessionEndedAt: null,
            sessionEndsAt: "2026-09-16T21:20:00Z",
            sessionStartedAt: "2026-09-16T21:00:00Z",
            therapistJoined: false,
            therapistArrivedAt: null,
            therapistJoinedAt: null,
            therapistPresentAtTolerance: false,
          },
          confirmation: { patient: null, therapist: null },
          divergent: false,
          financial: null,
          patient: null,
          pendingRoles: ["patient", "therapist"],
          therapist: null,
        },
      },
    };
    if (
      role === "quality-admin" &&
      data.sessionFeedback?.status === "available"
    ) {
      data.statusLabel = "confirmed";
      const feedback = data.sessionFeedback.data;
      feedback.attendance = {
        ...feedback.attendance,
        classification: null,
        incidentId: null,
        bothJoined: true,
        patientJoined: true,
        therapistJoined: true,
        therapistPresentAtTolerance: true,
        therapistArrivedAt: "2026-09-16T21:01:00Z",
        patientJoinedAt: "2026-09-16T21:02:00Z",
        therapistJoinedAt: "2026-09-16T21:02:00Z",
      };
      feedback.qualityReview = {
        isOpen: true,
        overdue: false,
        allAnswered: false,
      };
      feedback.qualityReports = [
        {
          id: "quality-report",
          authorRole: "patient",
          ticketId: "quality-ticket",
          dueAt: "2026-09-21T21:20:00Z",
          answeredAt: null,
          overdue: false,
        },
      ];
    }
    root.render(<AdminSessionDetailPage data={data} />);
    return;
  }
  root.render(
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <ZoomWaitingRoom
        actorRole="patient"
        isOnline
        kind="therapist_no_show"
        participantLabel="Terapeuta"
        previewLoading={false}
        scheduleLabel="18:00 – 18:20"
        sessionTitle="Reiki online"
        onJoin={() => {
          throw new Error("No-show must not allow join");
        }}
        onRefresh={() => {}}
        supportHref="/app/suporte"
      />
    </main>,
  );
}
void main();
