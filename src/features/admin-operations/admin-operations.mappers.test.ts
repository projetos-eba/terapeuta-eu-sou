import { describe, expect, it } from "vitest";

import {
  mapAdminOperationDetail,
  mapAdminOperationRows,
} from "./admin-operations.mappers";

describe("admin operation mappers", () => {
  it("maps professionals with public and operational fields", () => {
    expect(
      mapAdminOperationRows({
        module: "professionals",
        rows: [
          {
            id: "therapist-1",
            is_accepting_bookings: true,
            is_public: false,
            plan: "premium_plus",
            public_name: "Ana Oliveira",
            public_status: "draft",
            slug: "ana-oliveira",
            status: "approved",
            updated_at: "2026-08-08T10:00:00.000Z",
          },
        ],
      })[0],
    ).toEqual(
      expect.objectContaining({
        detailHref: "/admin/profissionais/therapist-1",
        id: "therapist-1",
        statusLabel: "approved",
        subtitle: "ana-oliveira",
        title: "Ana Oliveira",
      }),
    );
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
    expect(row?.fields).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "therapist-1" }),
      ]),
    );
  });

  it("keeps internal professional relationships out of verification detail fields", () => {
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
    expect(detail.sections.flatMap((section) => section.fields)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "therapist-1" }),
      ]),
    );
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
