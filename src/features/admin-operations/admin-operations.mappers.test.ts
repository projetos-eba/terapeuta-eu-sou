import { describe, expect, it } from "vitest";

import {
  mapAdminOperationDetail,
  mapAdminOperationRows,
} from "./admin-operations.mappers";

describe("admin operation mappers", () => {
  it("maps allowlisted client list data for contact, registration and direct detail access", () => {
    const [row] = mapAdminOperationRows({
      module: "patients",
      rows: [
        {
          account_status: "active",
          created_at: "2026-09-12T10:00:00.000Z",
          display_name: "Mariana Souza",
          email: "mariana@example.test",
          id: "client-1",
          phone: "11987654321",
          phone_country_code: "55",
          ticket_count: 8,
        },
      ],
    });

    expect(row).toMatchObject({
      detailHref: "/admin/pacientes/client-1",
      email: "mariana@example.test",
      id: "client-1",
      title: "Mariana Souza",
    });
    expect(row?.fields).toEqual(
      expect.arrayContaining([
        { label: "ID", value: "client-1" },
        { label: "Contato", value: "+55 (11) 98765-4321" },
        { label: "Cadastro", value: "12/09/2026" },
      ]),
    );
    expect(JSON.stringify(row)).not.toContain("ticket_count");
  });

  it("maps professionals with public and operational fields", () => {
    const [row] = mapAdminOperationRows({
      module: "professionals",
      rows: [
        {
          id: "therapist-1",
          is_accepting_bookings: true,
          is_public: false,
          email: "ana.oliveira@example.test",
          plan: "premium_plus",
          photo_url: "/images/avatar-terapeuta.jpeg",
          public_name: "Ana Oliveira",
          public_status: "draft",
          slug: "ana-oliveira",
          status: "approved",
          created_at: "2026-08-06T10:00:00.000Z",
          updated_at: "2026-08-08T10:00:00.000Z",
        },
      ],
    });

    expect(row).toEqual(
      expect.objectContaining({
        avatarUrl: "/images/avatar-terapeuta.jpeg",
        detailHref: "/admin/profissionais/therapist-1",
        email: "ana.oliveira@example.test",
        id: "therapist-1",
        statusLabel: "approved",
        subtitle: "ana-oliveira",
        title: "Ana Oliveira",
      }),
    );
    expect(row?.fields).toContainEqual({
      label: "Cadastro",
      value: "06/08/2026",
    });
  });

  it("opens the current verification for a professional awaiting approval", () => {
    const [row] = mapAdminOperationRows({
      module: "professionals",
      rows: [
        {
          id: "therapist-1",
          latest_verification_id: "verification-1",
          public_name: "Ana Oliveira",
          status: "in_review",
          verification_status: "in_review",
        },
      ],
    });

    expect(row?.detailHref).toBe(
      "/admin/profissionais/verificacoes/verification-1",
    );
  });

  it("maps allowlisted professional registration data for the detail screen", () => {
    const detail = mapAdminOperationDetail({
      auditEvents: [],
      generatedAt: "2026-09-26T10:00:00.000Z",
      module: "professionals",
      record: {
        admin_main_data: {
          birth_date: "1988-03-14",
          email: "mariana.silva@example.test",
          phone: "11987654321",
          phone_country_code: "55",
        },
        created_at: "2026-08-12T10:00:00.000Z",
        id: "therapist-1",
        public_name: "Mariana Silva",
      },
    });

    expect(detail.sections).toContainEqual({
      fields: [
        { label: "ID do profissional", value: "therapist-1" },
        { label: "E-mail", value: "mariana.silva@example.test" },
        { label: "Telefone", value: "+55 (11) 98765-4321" },
        { label: "Data de nascimento", value: "14/03/1988" },
        { label: "Data de cadastro", value: "12/08/2026" },
      ],
      title: "Dados principais",
    });
  });

  it("keeps the professional email visible when the read model returns it directly", () => {
    const detail = mapAdminOperationDetail({
      auditEvents: [],
      generatedAt: "2026-09-26T10:00:00.000Z",
      module: "professionals",
      record: {
        created_at: "2026-08-12T10:00:00.000Z",
        email: "mariana.silva@example.test",
        id: "therapist-1",
        public_name: "Mariana Silva",
      },
    });

    expect(detail.sections).toContainEqual(
      expect.objectContaining({
        fields: expect.arrayContaining([
          { label: "E-mail", value: "mariana.silva@example.test" },
        ]),
        title: "Dados principais",
      }),
    );
  });

  it("maps allowlisted identity and review fields for the verification queue", () => {
    const [row] = mapAdminOperationRows({
      module: "verifications",
      rows: [
        {
          id: "verification-1",
          publication_blockers: ["profile_incomplete"],
          status: "changes_requested",
          therapist_created_at: "2026-09-12T10:00:00.000Z",
          therapist_email: "ana.oliveira@example.test",
          therapist_name: "Ana Oliveira",
          therapist_photo_url: "/images/ana.jpeg",
          therapist_profile_id: "#TER-0001",
          updated_at: "2026-09-16T09:20:00.000Z",
        },
      ],
    });

    expect(row).toMatchObject({
      avatarUrl: "/images/ana.jpeg",
      detailHref: "/admin/profissionais/verificacoes/verification-1",
      email: "ana.oliveira@example.test",
      statusLabel: "changes_requested",
      title: "Ana Oliveira",
    });
    expect(row?.fields).toEqual(
      expect.arrayContaining([
        { label: "E-mail", value: "ana.oliveira@example.test" },
        { label: "ID do terapeuta", value: "#TER-0001" },
        { label: "Data de cadastro", value: "12/09/2026" },
        {
          label: "Pendência",
          value: "Ajustes solicitados · perfil ainda não está 100% completo",
        },
      ]),
    );
  });

  it("opens the professional detail from an approved verification", () => {
    const [row] = mapAdminOperationRows({
      module: "verifications",
      rows: [
        {
          id: "verification-1",
          status: "approved",
          therapist_name: "Ana Oliveira",
          therapist_profile_id: "therapist-1",
        },
      ],
    });

    expect(row?.detailHref).toBe("/admin/profissionais/therapist-1");
    expect(row?.statusLabel).toBe("Aprovado · falta publicar");
    expect(row?.fields).toContainEqual({
      label: "ID do terapeuta",
      value: "therapist-1",
    });
  });

  it("shows publication eligibility as success only after the profile is public", () => {
    const [row] = mapAdminOperationRows({
      module: "verifications",
      rows: [
        {
          id: "verification-2",
          publication_eligibility: { eligible: true },
          status: "approved",
          therapist_name: "Beatriz Lima",
          therapist_profile_id: "therapist-2",
        },
      ],
    });

    expect(row?.statusLabel).toBe("Publicado e elegível");
  });

  it("allowlists the professional identity needed in verification details", () => {
    const detail = mapAdminOperationDetail({
      auditEvents: [],
      generatedAt: "2026-08-15T02:00:00.000Z",
      module: "verifications",
      record: {
        id: "verification-1",
        status: "approved",
        therapist_name: "Ana Oliveira",
        therapist_profile_id: "therapist-1",
      },
    });

    expect(detail.relatedProfessionalId).toBe("therapist-1");
    expect(detail.sections).toContainEqual({
      fields: [{ label: "ID do terapeuta", value: "therapist-1" }],
      title: "Dados do profissional",
    });
  });

  it("maps email and registration date in the allowlisted verification detail", () => {
    const detail = mapAdminOperationDetail({
      auditEvents: [],
      generatedAt: "2026-09-26T10:00:00.000Z",
      module: "verifications",
      record: {
        admin_verification_professional: {
          created_at: "2026-09-12T10:00:00.000Z",
          email: "ana.oliveira@example.test",
          id: "#TER-0001",
        },
        id: "verification-1",
        status: "submitted",
        therapist_name: "Ana Oliveira",
      },
    });

    expect(detail.sections).toContainEqual({
      fields: [
        { label: "E-mail", value: "ana.oliveira@example.test" },
        { label: "ID do terapeuta", value: "#TER-0001" },
        { label: "Data de cadastro", value: "12/09/2026" },
      ],
      title: "Dados do profissional",
    });
  });

  it("does not expose review comments in admin moderation list rows", () => {
    const [row] = mapAdminOperationRows({
      module: "reviews",
      rows: [
        {
          comment: "Comentário privado que não deve aparecer.",
          created_at: "2026-08-08T10:00:00.000Z",
          id: "review-1",
          rating: 5,
          status: "published",
        },
      ],
    });

    expect(JSON.stringify(row)).not.toContain("Comentário privado");
    expect(row.detailHref).toBe("/admin/avaliacoes/review-1");
    expect(row.title).toBe("Avaliação operacional");
  });

  it("does not expose meeting urls in session rows", () => {
    const [row] = mapAdminOperationRows({
      module: "sessions",
      rows: [
        {
          id: "booking-1",
          meeting_url: "https://secret.example.test",
          payment_status: "paid",
          service_duration_minutes_snapshot: 60,
          service_title_snapshot: "Reiki",
          status: "confirmed",
        },
      ],
    });

    expect(JSON.stringify(row)).not.toContain("secret.example");
    expect(row.detailHref).toBe("/admin/sessoes/booking-1");
    expect(row.title).toBe("Reiki");
  });

  it("does not expose support ticket descriptions in list rows", () => {
    const [row] = mapAdminOperationRows({
      module: "support",
      rows: [
        {
          category: "payment",
          description: "Detalhe sensível do ticket.",
          id: "ticket-1",
          priority: "high",
          source: "app",
          status: "open",
          subject: "Ajuda com pagamento",
          urgency: "high",
        },
      ],
    });

    expect(JSON.stringify(row)).not.toContain("Detalhe sensível");
    expect(row.detailHref).toBe("/admin/suporte/ticket-1");
    expect(row.title).toBe("Ajuda com pagamento");
  });

  it("maps safe support details without exposing the ticket description", () => {
    const detail = mapAdminOperationDetail({
      auditEvents: [],
      generatedAt: "2026-08-08T10:00:00.000Z",
      module: "support",
      record: {
        category: "payment",
        description: "Descrição sensível fora da visão operacional.",
        id: "ticket-1",
        priority: "high",
        requester_name: "Paciente",
        source: "app",
        status: "open",
        subject: "Ajuda com pagamento",
        urgency: "high",
      },
    });

    expect(JSON.stringify(detail)).not.toContain("Descrição sensível");
    expect(detail.backHref).toBe("/admin/suporte");
    expect(detail.title).toBe("Ajuda com pagamento");
  });

  it("maps session video lifecycle with product language and no sensitive payload", () => {
    const detail = mapAdminOperationDetail({
      auditEvents: [],
      generatedAt: "2026-08-11T12:00:00.000Z",
      module: "sessions",
      record: {
        actual_ended_at: null,
        completed_at: null,
        ends_at: "2026-08-11T15:00:00.000Z",
        id: "booking-1",
        meeting_provider: "zoom",
        patient_name: "Marina Rocha",
        payment_status: "paid",
        service_duration_minutes_snapshot: 50,
        service_title_snapshot: "Aromaterapia",
        starts_at: "2026-08-11T14:00:00.000Z",
        status: "confirmed",
        therapist_name: "Ana Oliveira",
        timezone: "America/Sao_Paulo",
        video_session: {
          actual_started_at: "2026-08-11T14:03:00.000Z",
          control_jobs: [
            {
              attempts: 2,
              created_at: "2026-08-11T14:45:00.000Z",
              id: "job-private-id",
              last_error_code: "room-timeout",
              max_attempts: 5,
              next_run_at: "2026-08-11T14:55:00.000Z",
              operation: "end_hard_timeout",
              status: "retry",
              updated_at: "2026-08-11T14:50:00.000Z",
            },
          ],
          hard_ends_at: "2026-08-11T15:20:00.000Z",
          last_participant_left_at: "2026-08-11T14:41:00.000Z",
          last_provider_event_at: "2026-08-11T14:40:00.000Z",
          participant_count: 2,
          participations: [
            {
              duration_seconds: 1200,
              event_type: "session.user_joined",
              joined_at: "2026-08-11T14:03:00.000Z",
              participant_correlation_key: "private-correlation",
              participant_role: "therapist",
              provider_user_id: "provider-user",
            },
            {
              duration_seconds: 600,
              event_type: "session.user_left",
              left_at: "2026-08-11T14:35:00.000Z",
              participant_role: "patient",
            },
          ],
          provider_session_id: "provider-session-id",
          session_name: "secret-session-name",
          status: "active",
          termination_reason: "hard_timeout",
          therapist_first_joined_at: "2026-08-11T14:03:00.000Z",
          therapist_last_joined_at: "2026-08-11T14:03:00.000Z",
          therapist_last_left_at: "2026-08-11T14:41:00.000Z",
          therapist_present: true,
        },
      },
    });

    expect(detail.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Sala online",
          fields: expect.arrayContaining([
            { label: "Situação da sala", value: "Em andamento" },
            {
              label: "Profissional na sala",
              value: "Profissional presente agora",
            },
            {
              label: "Motivo do encerramento",
              value: "Encerrada ao atingir o limite de segurança",
            },
          ]),
        }),
        expect.objectContaining({
          title: "Participação na sala",
          fields: expect.arrayContaining([
            { label: "Movimentações recentes", value: "2" },
            expect.objectContaining({
              label: "Movimentação mais recente do profissional",
              value: expect.stringContaining("Profissional entrou na sala"),
            }),
          ]),
        }),
        expect.objectContaining({
          title: "Acompanhamento do encerramento",
          fields: expect.arrayContaining([
            {
              label: "Objetivo do acompanhamento",
              value: "Encerrar ao atingir o limite de segurança",
            },
            {
              label: "Situação do acompanhamento",
              value: "Nova tentativa agendada",
            },
          ]),
        }),
      ]),
    );

    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("secret-session-name");
    expect(serialized).not.toContain("provider-session-id");
    expect(serialized).not.toContain("provider-user");
    expect(serialized).not.toContain("private-correlation");
    expect(serialized).not.toContain("room-timeout");
  });

  it("maps bilateral session feedback, pending participant and divergence", () => {
    const detail = mapAdminOperationDetail({
      auditEvents: [],
      generatedAt: "2026-08-22T22:00:00.000Z",
      module: "sessions",
      record: {
        id: "booking-1",
        session_feedback: {
          attendance: {
            bothJoined: true,
            patientJoined: true,
            sessionClosed: true,
            sessionEndedAt: "2026-08-22T22:00:00.000Z",
            sessionEndsAt: "2026-08-22T21:50:00.000Z",
            sessionStartedAt: "2026-08-22T21:00:00.000Z",
            therapistJoined: true,
          },
          confirmation: { patient: null, therapist: null },
          divergent: true,
          financial: null,
          patient: {
            authorRole: "patient",
            comment: "A chamada aconteceu.",
            createdAt: "2026-08-22T21:00:00.000Z",
            notPerformedReason: null,
            outcome: "completed",
            rating: 5,
          },
          pendingRoles: ["therapist"],
          therapist: null,
          requestId: "server-only-request-id",
        },
      },
    });

    expect(detail.sessionFeedback).toEqual({
      data: {
        attendance: {
          bothJoined: true,
          classification: null,
          classificationSource: null,
          financialResolution: null,
          incidentId: null,
          patientArrivedAt: null,
          patientJoined: true,
          patientJoinedAt: null,
          patientPresentAtTolerance: false,
          processingCostRecoveryAuthorized: false,
          resolution: null,
          responsibility: null,
          retentionAuthorized: false,
          reviewDueAt: null,
          sessionClosed: true,
          sessionEndedAt: "2026-08-22T22:00:00.000Z",
          sessionEndsAt: "2026-08-22T21:50:00.000Z",
          sessionStartedAt: "2026-08-22T21:00:00.000Z",
          therapistArrivedAt: null,
          therapistJoined: true,
          therapistJoinedAt: null,
          therapistPresentAtTolerance: false,
        },
        confirmation: { patient: null, therapist: null },
        divergent: true,
        financial: null,
        patient: expect.objectContaining({ rating: 5 }),
        pendingRoles: ["therapist"],
        therapist: null,
      },
      status: "available",
    });
    expect(JSON.stringify(detail)).not.toContain("server-only-request-id");
  });

  it("maps honest session detail when the online room is not available yet", () => {
    const detail = mapAdminOperationDetail({
      auditEvents: [],
      generatedAt: "2026-08-11T12:00:00.000Z",
      module: "sessions",
      record: {
        id: "booking-2",
        patient_name: "Marina Rocha",
        payment_status: "pending",
        service_duration_minutes_snapshot: 50,
        service_title_snapshot: "Aromaterapia",
        starts_at: "2026-08-11T14:00:00.000Z",
        status: "pending_payment",
        therapist_name: "Ana Oliveira",
      },
    });

    expect(detail.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Sala online",
          fields: [
            {
              label: "Situação da sala",
              value: "A sala online ainda não possui atividade registrada.",
            },
          ],
        }),
        expect.objectContaining({
          title: "Participação na sala",
          fields: [
            {
              label: "Resumo da participação",
              value:
                "Ainda não há movimentações registradas para a sala online desta sessão.",
            },
          ],
        }),
        expect.objectContaining({
          title: "Acompanhamento do encerramento",
          fields: [
            {
              label: "Acompanhamento do encerramento",
              value:
                "Ainda não há acompanhamento automático registrado para esta sessão.",
            },
          ],
        }),
      ]),
    );
  });

  it("maps safe verification details without exposing document metadata", () => {
    const detail = mapAdminOperationDetail({
      auditEvents: [],
      generatedAt: "2026-08-08T10:00:00.000Z",
      module: "verifications",
      record: {
        documents_metadata: { privatePath: "bucket/private/document.pdf" },
        id: "verification-1",
        status: "submitted",
        therapist_name: "Ana Oliveira",
      },
    });

    expect(JSON.stringify(detail)).not.toContain("document.pdf");
    expect(detail.backHref).toBe("/admin/profissionais/verificacoes");
    expect(detail.title).toBe("Ana Oliveira");
  });
});
