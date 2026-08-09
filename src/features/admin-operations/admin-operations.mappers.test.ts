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
