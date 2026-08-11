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
                { label: "Formato", value: "Online" },
              ],
              title: "Participantes",
            },
            {
              fields: [
                { label: "Situação da sala", value: "Em andamento" },
                { label: "Início real", value: "11/08/2026, 14:03" },
                {
                  label: "Limite de segurança",
                  value: "11/08/2026, 15:20",
                },
                {
                  label: "Profissional na sala",
                  value: "Profissional presente agora",
                },
                {
                  label: "Último evento recebido",
                  value: "11/08/2026, 14:40",
                },
              ],
              title: "Sala online",
            },
            {
              fields: [
                { label: "Movimentações recentes", value: "2" },
                {
                  label: "Movimentação mais recente do profissional",
                  value:
                    "Profissional entrou na sala em 11/08/2026, 14:03 (20 min de permanência)",
                },
              ],
              title: "Participação na sala",
            },
            {
              fields: [
                {
                  label: "Objetivo do acompanhamento",
                  value: "Encerrar ao atingir o limite de segurança",
                },
                {
                  label: "Situação do acompanhamento",
                  value: "Nova tentativa agendada",
                },
              ],
              title: "Acompanhamento do encerramento",
            },
          ],
        })}
      />,
    );

    expect(html).toContain("Detalhes da sessão");
    expect(html).toContain("Ana Oliveira");
    expect(html).toContain("Online");
    expect(html).toContain("Em andamento");
    expect(html).toContain("Profissional presente agora");
    expect(html).toContain("Nova tentativa agendada");
    expect(html).not.toContain("Booking");
    expect(html).not.toContain("Provider online");
    expect(html).not.toContain("session.user_joined");
    expect(html).not.toContain("provider_session_id");
    expect(html).not.toContain("JWT");
  });

  it("renders an honest session detail when the online room has no safe payload yet", () => {
    const html = renderToStaticMarkup(
      <AdminSessionDetailPage
        data={detailData({
          sections: [
            {
              fields: [
                { label: "Pagamento", value: "pending" },
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
                { label: "Formato", value: "Online" },
              ],
              title: "Participantes",
            },
            {
              fields: [
                {
                  label: "Situação da sala",
                  value: "A sala online ainda não possui atividade registrada.",
                },
              ],
              title: "Sala online",
            },
          ],
          statusLabel: "pending_payment",
        })}
      />,
    );

    expect(
      html.match(/A sala online ainda não possui atividade registrada\./g),
    ).toHaveLength(1);
    expect(html).toContain("Quando ainda não há atividade registrada");
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
