import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminOperationDetailPageData } from "../admin-operations.types";
import { AdminProfessionalDetailPage } from "./admin-professional-detail-page";
import { AdminSessionDetailPage } from "./admin-session-detail-page";
import { AdminSupportDetailPage } from "./admin-support-detail-page";
import { AdminVerificationDetailPage } from "./admin-verification-detail-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(() => {
  cleanup();
});

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
  it("renders the professional profile as a safe published projection", () => {
    const html = renderToStaticMarkup(
      <AdminProfessionalDetailPage
        data={detailData({
          backHref: "/admin/profissionais",
          module: "professionals",
          publicProfile: {
            content: {
              essenceBody: "Escuta responsável e combinados claros.",
              experienceYears: 8,
              guideItems: [{ label: "Escuta atenta" }],
              invitationBody: "Conheça esta abordagem com tranquilidade.",
              shortIntro: "Presença para o seu momento.",
            },
            services: [
              {
                description: "Atendimento online.",
                durationMinutes: 60,
                priceCents: 18000,
                serviceTitle: "Encontro de Reiki",
                therapyName: "Reiki",
              },
            ],
            status: "available",
          },
          sections: [
            {
              fields: [
                { label: "ID do perfil", value: "private-profile-id" },
                { label: "Slug público", value: "ana-oliveira" },
                { label: "Cidade", value: "São Paulo, SP" },
                { label: "Idiomas", value: "Português" },
              ],
              title: "Identidade operacional",
            },
            {
              fields: [
                { label: "Plano", value: "premium" },
                { label: "Publicado", value: "Sim" },
                { label: "Recebe reservas", value: "Sim" },
                { label: "Perfil público", value: "published" },
                {
                  label: "Elegibilidade pública",
                  value: "Publicado e elegível",
                },
              ],
              title: "Estado do perfil",
            },
            {
              fields: [
                { label: "Serviços ativos", value: "1" },
                { label: "Próxima sessão", value: "Sem agenda futura" },
              ],
              title: "Operação",
            },
            {
              fields: [{ label: "Criado em", value: "11/08/2026, 08:36" }],
              title: "Rastreabilidade",
            },
          ],
          statusLabel: "approved",
          title: "Ana Oliveira",
          privateDocuments: {
            documents: [
              {
                description: "Envie um documento oficial com foto e boa legibilidade.",
                fileName: "rg-frente.pdf",
                helper: "RG, CNH ou passaporte com foto.",
                id: "11111111-1111-4111-8111-111111111111",
                kind: "identity_document",
                mimeType: "application/pdf",
                sizeBytes: 1_200_000,
                status: "uploaded",
                title: "Documento de identidade",
                uploadedAt: "2026-08-14T09:18:00.000Z",
                validationState: "pending",
              },
              {
                description: "Envie um comprovante recente emitido nos últimos 90 dias.",
                fileName: "endereco.pdf",
                helper: "Conta de luz, água, telefone ou documento equivalente.",
                id: "22222222-2222-4222-8222-222222222222",
                kind: "address_proof",
                mimeType: "application/pdf",
                sizeBytes: 830_000,
                status: "accepted",
                title: "Comprovante de endereço",
                uploadedAt: "2026-08-14T09:19:00.000Z",
                validationState: "passed",
              },
            ],
            summary: {
              description:
                "Confira os arquivos recebidos e use esta leitura como apoio à decisão administrativa.",
              hasDocuments: true,
              title: "Documentos enviados",
            },
            therapistProfileId: "private-profile-id",
            timeline: {
              steps: [
                {
                  detail: "11/08/2026",
                  key: "created",
                  label: "Enviado",
                  state: "complete",
                },
                {
                  detail: "14/08/2026",
                  key: "review",
                  label: "Em análise",
                  state: "complete",
                },
                {
                  detail: "14/08/2026",
                  key: "approved",
                  label: "Aprovado",
                  state: "complete",
                },
                {
                  detail: "Ativo",
                  key: "published",
                  label: "Publicado",
                  state: "complete",
                },
                {
                  detail: "Ativo",
                  key: "bookable",
                  label: "Disponível para agendamento",
                  state: "current",
                },
              ],
            },
            verificationStatus: "approved",
          },
          verificationSummary: {
            reviewedAt: "2026-08-14T09:18:00.000Z",
            status: "approved",
            submittedAt: "2026-08-11T08:36:00.000Z",
          },
        })}
      />,
    );

    expect(html).toContain("Ana Oliveira");
    expect(html).toContain("Perfil");
    expect(html).toContain("Publicado e elegível");
    expect(html).toContain("Fluxo do perfil");
    expect(html).toContain("Disponível para agendamento");
    expect(html).toContain("Abrir fila de verificações");
    expect(html).toContain("Documentos");
    expect(html).not.toContain("ID do perfil");
    expect(html).not.toContain("private-profile-id");
  });

  it("reveals the published profile through the Profile tab", () => {
    render(
      <AdminProfessionalDetailPage
        data={detailData({
          backHref: "/admin/profissionais",
          module: "professionals",
          publicProfile: {
            content: {
              essenceBody: "Escuta responsável e combinados claros.",
              experienceYears: null,
              guideItems: [],
              invitationBody: null,
              shortIntro: "Presença para o seu momento.",
            },
            services: [],
            status: "available",
          },
          sections: [
            { fields: [], title: "Identidade operacional" },
            {
              fields: [
                { label: "Publicado", value: "Não" },
                { label: "Recebe reservas", value: "Não" },
                { label: "Perfil público", value: "unpublished" },
              ],
              title: "Estado do perfil",
            },
            { fields: [], title: "Operação" },
            { fields: [], title: "Rastreabilidade" },
          ],
          statusLabel: "approved",
          title: "Ana Oliveira",
          verificationSummary: {
            reviewedAt: null,
            status: "submitted",
            submittedAt: "2026-08-11T08:36:00.000Z",
          },
        })}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Perfil" }));

    expect(
      screen.getByRole("heading", { name: "Perfil publicado" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Presença para o seu momento."),
    ).toBeInTheDocument();
  });

  it("reveals the private documents review through the Documents tab", () => {
    render(
      <AdminProfessionalDetailPage
        data={detailData({
          backHref: "/admin/profissionais",
          module: "professionals",
          privateDocuments: {
            documents: [
              {
                description: "Envie um documento oficial com foto e boa legibilidade.",
                fileName: "rg-frente.pdf",
                helper: "RG, CNH ou passaporte com foto.",
                id: "11111111-1111-4111-8111-111111111111",
                kind: "identity_document",
                mimeType: "application/pdf",
                sizeBytes: 1_200_000,
                status: "uploaded",
                title: "Documento de identidade",
                uploadedAt: "2026-08-14T09:18:00.000Z",
                validationState: "pending",
              },
              {
                description: "Envie um comprovante recente emitido nos últimos 90 dias.",
                fileName: null,
                helper: "Conta de luz, água, telefone ou documento equivalente.",
                id: null,
                kind: "address_proof",
                mimeType: null,
                sizeBytes: null,
                status: "missing",
                title: "Comprovante de endereço",
                uploadedAt: null,
                validationState: null,
              },
            ],
            summary: {
              description:
                "Confira os arquivos recebidos e use esta leitura como apoio à decisão administrativa.",
              hasDocuments: true,
              title: "Documentos enviados",
            },
            therapistProfileId: "private-profile-id",
            timeline: { steps: [] },
            verificationStatus: "submitted",
          },
          sections: [
            { fields: [], title: "Identidade operacional" },
            { fields: [], title: "Estado do perfil" },
            { fields: [], title: "Operação" },
            { fields: [], title: "Rastreabilidade" },
          ],
          title: "Ana Oliveira",
        })}
      />,
    );

    fireEvent.click(screen.getAllByRole("tab", { name: "Documentos" })[0]!);

    expect(
      screen.getByRole("heading", { name: "Documentos enviados" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Documento de identidade")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Visualizar" })).toHaveAttribute(
      "href",
      "/api/admin/profissionais/00000000-0000-4000-8000-000000000001/documents/11111111-1111-4111-8111-111111111111",
    );
    expect(screen.getAllByText("Pendente").length).toBeGreaterThan(0);
  });

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
    expect(html).toContain("Resolver chamado");
    expect(html).not.toContain("Fonte segura");
  });

  it("guides a submitted verification into analysis before a decision", () => {
    const html = renderToStaticMarkup(
      <AdminVerificationDetailPage
        data={detailData({
          backHref: "/admin/profissionais/verificacoes",
          module: "verifications",
          relatedProfessionalId: "c1000000-0000-4000-8000-000000000001",
          sections: [
            {
              fields: [
                { label: "Status", value: "submitted" },
                { label: "Terapeuta", value: "Ana Oliveira" },
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
    expect(html).toContain("Ver cadastro do profissional");
    expect(html).not.toContain("Aprovar verificação");
  });
});
