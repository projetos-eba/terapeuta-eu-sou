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
                { label: "ID do profissional", value: "private-profile-id" },
                { label: "E-mail", value: "ana@example.test" },
                { label: "Telefone", value: "+55 (11) 98765-4321" },
                { label: "Data de nascimento", value: "14/03/1988" },
                { label: "Data de cadastro", value: "11/08/2026" },
              ],
              title: "Dados principais",
            },
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
    expect(html).toContain("Dados principais");
    expect(html).toContain("ID do profissional");
    expect(html).toContain("private-profile-id");
    expect(html).toContain("ana@example.test");
    expect(html).toContain("14/03/1988");
    expect(html).not.toContain("ID do perfil");
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

  it("keeps submitted profile content and private contact details inside their tabs", () => {
    render(
      <AdminProfessionalDetailPage
        data={detailData({
          backHref: "/admin/profissionais",
          module: "professionals",
          profileReview: {
            contentVersionId: "content-version-id",
            fields: {
              bio: null,
              city: "Campinas",
              country: "BR",
              essenceBody: "Uma escuta cuidadosa e responsável.",
              experienceYears: 6,
              guideItems: [{ label: "Autoconhecimento" }],
              headline: null,
              invitationBody: "Vamos construir este caminho com calma.",
              photoUrl: null,
              publicName: "Ana Oliveira",
              shortIntro: "Presença para o seu momento.",
              state: "SP",
              videoProvider: null,
              videoThumbnailUrl: null,
              videoTitle: null,
              videoUrl: null,
            },
            privateIdentity: {
              city: "Campinas",
              complement: "Sala 12",
              country: "BR",
              documentNumber: "52998224725",
              documentType: "cpf",
              neighborhood: "Cambuí",
              phone: "11999999999",
              phoneCountryCode: "55",
              postalCode: "13060240",
              state: "SP",
              street: "Avenida Ibirapuera",
              streetNumber: "537",
            },
            profileStatus: "submitted",
            publicStatus: "unpublished",
            publishedAt: null,
            services: [
              {
                currency: "BRL",
                description: "Atendimento online individual.",
                durationMinutes: 50,
                priceCents: 18000,
                status: "active",
                therapyName: "Tarô",
                title: "Tarô terapêutico",
              },
            ],
            verificationStatus: "submitted",
          },
          sections: [
            { fields: [], title: "Identidade operacional" },
            { fields: [], title: "Estado do perfil" },
            { fields: [], title: "Operação" },
            {
              fields: [{ label: "Criado em", value: "06/08/2026, 17:10" }],
              title: "Rastreabilidade",
            },
          ],
          title: "Ana Oliveira",
        })}
      />,
    );

    expect(screen.queryByText("Dados e contato")).not.toBeInTheDocument();
    expect(screen.getByText("Na plataforma desde")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Perfil" }));

    expect(
      screen.getByRole("heading", { name: "Meu perfil" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Dados e contato" }),
    ).toBeInTheDocument();
    expect(screen.getByText("529.982.247-25")).toBeInTheDocument();
    expect(screen.getByText("+55 (11) 99999-9999")).toBeInTheDocument();
    expect(screen.getByText("13060-240")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Serviços e terapias" }));

    expect(screen.getByText("Tarô terapêutico")).toBeInTheDocument();
    expect(
      screen.getByText("Atendimento online individual."),
    ).toBeInTheDocument();
  });

  it("formats the professional history as an operational timeline table", () => {
    render(
      <AdminProfessionalDetailPage
        data={detailData({
          auditEvents: [
            {
              action: "verification.approve",
              actorRole: "admin",
              createdAt: "2026-08-14T12:18:00.000Z",
              id: "audit-1",
              permission: "admin.professionals.verify",
              reason: "Documentos e perfil conferidos.",
              source: "admin",
            },
            {
              action: "professional.suspend",
              actorRole: "service_role",
              createdAt: "2026-08-13T19:45:00.000Z",
              id: "audit-2",
              permission: null,
              reason: null,
              source: "admin",
            },
          ],
          backHref: "/admin/profissionais",
          module: "professionals",
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

    fireEvent.click(screen.getByRole("tab", { name: "Histórico" }));

    expect(
      screen.getByRole("heading", { name: "Histórico do profissional" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Data e hora")).toBeInTheDocument();
    expect(screen.getAllByText("Responsável").length).toBeGreaterThan(0);
    expect(screen.getByText("Verificação aprovada")).toBeInTheDocument();
    expect(screen.getByText("Documentos e perfil conferidos.")).toBeInTheDocument();
    expect(screen.getByText("Administrador")).toBeInTheDocument();
    expect(screen.getByText("Sistema TES")).toBeInTheDocument();
    expect(screen.getByText("Sem observações adicionais.")).toBeInTheDocument();
  });

  it("shows the completed administrative path for an approved legacy profile", () => {
    const html = renderToStaticMarkup(
      <AdminProfessionalDetailPage
        data={detailData({
          backHref: "/admin/profissionais",
          module: "professionals",
          sections: [
            { fields: [], title: "Identidade operacional" },
            {
              fields: [
                { label: "Publicado", value: "Sim" },
                { label: "Recebe reservas", value: "Sim" },
                { label: "Perfil público", value: "published" },
              ],
              title: "Estado do perfil",
            },
            { fields: [], title: "Operação" },
            {
              fields: [{ label: "Criado em", value: "11/08/2026, 08:36" }],
              title: "Rastreabilidade",
            },
          ],
          statusLabel: "approved",
          title: "Ana Oliveira",
          verificationSummary: {
            reviewedAt: null,
            source: "profile_status",
            status: "approved",
            submittedAt: null,
          },
        })}
      />,
    );

    expect(html).toContain("A situação atual do cadastro confirma a aprovação administrativa.");
    expect(html).not.toContain("Ainda não existe envio confirmado para análise.");
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
    expect(html).toContain("lucide-clock3");
    expect(html).toContain("lucide-credit-card");
    expect(html).toContain("lucide-users-round");
    expect(html).toContain("lucide-monitor");
    expect(html).toContain("lucide-radio");
    expect(html).toContain("lucide-calendar-clock");
    expect(html).not.toContain("Booking");
    expect(html).not.toContain("Provider online");
    expect(html).not.toContain("session.user_joined");
    expect(html).not.toContain("provider_session_id");
    expect(html).not.toContain("JWT");
  });

  it("does not call an unclosed therapist no-show room ready for entry", () => {
    const html = renderToStaticMarkup(
      <AdminSessionDetailPage
        data={detailData({
          statusLabel: "no_show_therapist",
          sections: [
            { title: "Sessão", fields: [{ label: "Pagamento", value: "paid" }] },
            { title: "Sala online", fields: [{ label: "Situação da sala", value: "Pronta para iniciar" }] },
          ],
          sessionFeedback: {
            status: "available",
            data: {
              qualityReview: { isOpen: false, overdue: false, allAnswered: false },
              attendance: {
                bothJoined: false,
                classification: "no_show_therapist",
                classificationSource: "authenticated_waiting_room",
                financialResolution: "pending",
                incidentId: null,
                patientArrivedAt: "2026-09-16T21:00:00Z",
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
        })}
      />,
    );

    expect(html).toContain("Acesso bloqueado — encerramento pendente");
    expect(html).toContain("Sessão não realizada — terapeuta não compareceu");
    expect(html).toContain("Financeiro — independente da confirmação");
    expect(html).toContain("lucide-landmark");
    expect(html).toContain(">Pago</");
    expect(html).toContain("avaliação de qualidade indisponível");
    expect(html).toContain("Não se aplica — sessão não realizada.");
    expect(html).not.toContain("Pendente: o cliente e o terapeuta");
    expect(html).not.toContain("Análise de qualidade: somente auditoria");
    expect(html).not.toContain("Pronta para iniciar");
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
    expect(html).toContain("Triagem");
    expect(html).toContain("Nota interna");
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

  it("shows the allowlisted professional identity in a verification detail", () => {
    const html = renderToStaticMarkup(
      <AdminVerificationDetailPage
        data={detailData({
          backHref: "/admin/profissionais/verificacoes",
          module: "verifications",
          sections: [
            {
              fields: [
                { label: "E-mail", value: "ana.oliveira@example.test" },
                { label: "ID do terapeuta", value: "#TER-0001" },
                { label: "Data de cadastro", value: "12/09/2026" },
              ],
              title: "Dados do profissional",
            },
            {
              fields: [
                { label: "Status", value: "submitted" },
                { label: "Terapeuta", value: "Ana Oliveira" },
              ],
              title: "Verificação",
            },
          ],
          title: "Ana Oliveira",
        })}
      />,
    );

    expect(html).toContain("Dados do profissional");
    expect(html).toContain("ana.oliveira@example.test");
    expect(html).toContain("#TER-0001");
    expect(html).toContain("12/09/2026");
  });

  it("shows formatted private contact data in the professional verification", () => {
    const html = renderToStaticMarkup(
      <AdminVerificationDetailPage
        data={detailData({
          backHref: "/admin/profissionais/verificacoes",
          module: "verifications",
          profileReview: {
            contentVersionId: "content-version-id",
            fields: {
              bio: null,
              city: "Campinas",
              country: "BR",
              essenceBody: "Uma escuta cuidadosa e responsável.",
              experienceYears: null,
              guideItems: [],
              headline: null,
              invitationBody: null,
              photoUrl: null,
              publicName: "Ana Oliveira",
              shortIntro: "Presença para o seu momento.",
              state: "SP",
              videoProvider: null,
              videoThumbnailUrl: null,
              videoTitle: null,
              videoUrl: null,
            },
            privateIdentity: {
              city: "Campinas",
              complement: null,
              country: "BR",
              documentNumber: "52998224725",
              documentType: "cpf",
              neighborhood: "Cambuí",
              phone: "11999999999",
              phoneCountryCode: "55",
              postalCode: "13060240",
              state: "SP",
              street: "Avenida Ibirapuera",
              streetNumber: "537",
            },
            profileStatus: "submitted",
            publicStatus: "unpublished",
            publishedAt: null,
            services: [],
            verificationStatus: "submitted",
          },
          sections: [
            {
              fields: [
                { label: "Status", value: "submitted" },
                { label: "Terapeuta", value: "Ana Oliveira" },
              ],
              title: "Verificação",
            },
          ],
          title: "Ana Oliveira",
        })}
      />,
    );

    expect(html).toContain("Dados e contato");
    expect(html).toContain("529.982.247-25");
    expect(html).toContain("+55 (11) 99999-9999");
    expect(html).toContain("13060-240");
    expect(html).toContain("Avenida Ibirapuera, 537");
  });

  it.runIf(process.env.ADMIN_SESSION_DETAIL_VISUAL_QA === "1")(
    "keeps session details legible at desktop, tablet and mobile widths",
    async () => {
      const { existsSync, readFileSync } = await import("node:fs");
      const { resolve } = await import("node:path");
      const { chromium } = await import("@playwright/test");
      const postcss = (await import("postcss")).default;
      const tailwindcss = (await import("tailwindcss")).default;
      const stylePath = resolve("src/app/globals.css");
      const css = (
        await postcss([tailwindcss()]).process(
          readFileSync(stylePath, "utf8"),
          { from: stylePath },
        )
      ).css.replace(
        /url\("(\/fonts\/[^\"]+)"\)/g,
        (_match, fontPath: string) =>
          `url("data:font/otf;base64,${readFileSync(resolve(`public${fontPath}`)).toString("base64")}")`,
      );
      const browserExecutable = [
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      ].find((path) => existsSync(path));
      const browser = await chromium.launch({
        executablePath: browserExecutable,
        headless: false,
      });

      try {
        const browserPage = await browser.newPage();
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
                  fields: [
                    { label: "Início", value: "11/08/2026, 14:00" },
                    { label: "Duração", value: "50 min" },
                  ],
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
                      label: "Profissional na sala",
                      value: "Profissional presente agora",
                    },
                  ],
                  title: "Sala online",
                },
                {
                  fields: [{ label: "Movimentações recentes", value: "2" }],
                  title: "Participação na sala",
                },
                {
                  fields: [
                    {
                      label: "Situação do acompanhamento",
                      value: "Nova tentativa agendada",
                    },
                  ],
                  title: "Acompanhamento do encerramento",
                },
                {
                  fields: [{ label: "Criado em", value: "11/08/2026, 13:55" }],
                  title: "Rastreabilidade",
                },
              ],
            })}
          />,
        );

        for (const width of [1440, 1024, 390]) {
          await browserPage.setViewportSize({ width, height: 900 });
          await browserPage.setContent(
            `<!doctype html><html lang="pt-BR"><head><style>${css}</style></head><body><div class="tes-authenticated-surface px-4 py-6">${html}</div></body></html>`,
          );
          await browserPage.evaluate(() => document.fonts.ready);
          expect(
            await browserPage.evaluate(
              () =>
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth,
            ),
          ).toBe(true);
          await browserPage.screenshot({
            path: resolve(
              `test-results/admin-session-detail-component-qa/detail-${width}.png`,
            ),
            fullPage: true,
          });
        }
      } finally {
        await browser.close();
      }
    },
    60_000,
  );
});
