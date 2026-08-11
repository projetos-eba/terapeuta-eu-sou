import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { AdminOperationDetailPageData } from "../admin-operations.types";
import { AdminSessionDetailPage } from "./admin-session-detail-page";
import { AdminSupportDetailPage } from "./admin-support-detail-page";
import { AdminVerificationDetailPage } from "./admin-verification-detail-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

function detailData(
  overrides: Partial<AdminOperationDetailPageData>,
): AdminOperationDetailPageData {
  return {
    auditEvents: [],
    backHref: "/admin/sessoes",
    generatedAt: "2026-08-11T12:00:00.000Z",
    id: "00000000-0000-4000-8000-000000000001",
    module: "sessions",
    safetyNotes: [],
    sections: [],
    statusLabel: "confirmed",
    subtitle: "",
    title: "Aromaterapia",
    ...overrides,
  };
}

describe("admin operation detail pages", () => {
  it("renders session details with product language", () => {
    const html = renderToStaticMarkup(
      <AdminSessionDetailPage
        data={detailData({
          sections: [
            {
              fields: [
                { label: "Pagamento", value: "paid" },
                { label: "Serviço", value: "Aromaterapia" },
                { label: "Duração", value: "50 min" },
              ],
              title: "Sessão",
            },
            {
              fields: [{ label: "Início", value: "11/08/2026, 14:00" }],
              title: "Agenda",
            },
            {
              fields: [
                { label: "Terapeuta", value: "Ana Oliveira" },
                { label: "Cliente", value: "Marina Rocha" },
                { label: "Provider online", value: "zoom" },
              ],
              title: "Participantes",
            },
          ],
        })}
      />,
    );

    expect(html).toContain("Detalhes da sessão");
    expect(html).toContain("Ana Oliveira");
    expect(html).toContain("Online");
    expect(html).not.toContain("Provider online");
    expect(html).not.toContain("Booking");
  });

  it("renders support context and available action", () => {
    const html = renderToStaticMarkup(
      <AdminSupportDetailPage
        data={detailData({
          backHref: "/admin/suporte",
          module: "support",
          sections: [
            {
              fields: [
                { label: "Categoria", value: "payment" },
                { label: "Prioridade", value: "high" },
                { label: "Urgência", value: "medium" },
              ],
              title: "Ticket",
            },
            {
              fields: [{ label: "Solicitante", value: "Marina Rocha" }],
              title: "Relacionamentos",
            },
          ],
          statusLabel: "open",
          title: "Dúvida sobre pagamento",
        })}
      />,
    );

    expect(html).toContain("Detalhes do suporte");
    expect(html).toContain("Prioridade Alta");
    expect(html).toContain("Resolver ticket");
    expect(html).not.toContain("Fonte segura");
  });

  it("guides a submitted verification into analysis before a decision", () => {
    const html = renderToStaticMarkup(
      <AdminVerificationDetailPage
        data={detailData({
          backHref: "/admin/profissionais/verificacoes",
          module: "verifications",
          sections: [
            {
              fields: [
                { label: "Status", value: "submitted" },
                { label: "Terapeuta", value: "Ana Oliveira" },
                {
                  label: "Perfil terapeuta",
                  value: "c1000000-0000-4000-8000-000000000001",
                },
              ],
              title: "Verificação",
            },
          ],
          statusLabel: "submitted",
          title: "Ana Oliveira",
        })}
      />,
    );

    expect(html).toContain("Aguardando análise");
    expect(html).toContain("Iniciar análise");
    expect(html).toContain("Abrir cadastro do profissional");
    expect(html).not.toContain("Aprovar verificação");
  });
});
