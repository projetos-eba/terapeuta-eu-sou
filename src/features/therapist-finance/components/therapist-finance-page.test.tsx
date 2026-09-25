import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  TherapistAdvancedFinancialDashboard,
  TherapistFinanceDateRange,
  TherapistFinanceFilters,
  TherapistFinancePageData,
} from "../therapist-finance.types";
import { TherapistFinancePage } from "./therapist-finance-page";

vi.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

afterEach(cleanup);

describe("TherapistFinancePage", () => {
  it("renders the four approved tabs and no dedicated history tab", () => {
    renderPage();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Financeiro completo",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Resumo" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Recebimentos" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Repasses" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Conta de recebimento" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^Histórico$/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the approved value composition without adjustments", () => {
    renderPage();

    expect(screen.getAllByText("Valor bruto").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Custos da plataforma").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByText("Incluídos no cálculo do repasse"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Custos da plataforma incluem os valores previstos/i),
    ).toBeInTheDocument();
    const costTooltip = screen.getByRole("tooltip", {
      name: /Custos da plataforma incluem os valores previstos/i,
    });
    expect(costTooltip).toHaveClass("invisible");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Saiba mais sobre Custos da plataforma",
      }),
    );
    expect(costTooltip).toHaveClass("visible");
    expect(screen.queryByText("Evolução recente")).not.toBeInTheDocument();
    expect(screen.getAllByText("Valor líquido").length).toBeGreaterThan(0);
    expect(
      screen.queryByText(new RegExp(["ajus", "tes"].join(""), "i")),
    ).not.toBeInTheDocument();
  });

  it("shows refunds as already reflected information instead of subtracting them twice", () => {
    renderPage();

    expect(
      screen.getByText("Informativo — já refletido nos valores acima"),
    ).toBeInTheDocument();
    expect(screen.queryByText("− R$ 10,00")).not.toBeInTheDocument();
    expect(screen.getAllByText("R$ 10,00").length).toBeGreaterThan(0);

    fireEvent.click(
      screen.getByRole("button", { name: "Saiba mais sobre Seu dinheiro" }),
    );
    expect(
      screen.getByText(
        "O valor líquido já considera os reembolsos confirmados. O total devolvido aparece apenas como informação e não deve ser subtraído.",
      ),
    ).toBeVisible();
  });

  it("offers a contextual explanation for every summary indicator", () => {
    renderPage();

    const indicators = [
      [
        "Receita líquida",
        "É o valor que pertence a você após os custos da plataforma e os reembolsos confirmados, quando houver.",
      ],
      [
        "A receber",
        "Mostra os valores previstos para os próximos repasses e os que ainda não têm uma data bancária confirmada.",
      ],
      [
        "Sessões concluídas",
        "Conta as sessões concluídas ou confirmadas no período selecionado.",
      ],
    ] as const;

    for (const [label, explanation] of indicators) {
      fireEvent.click(
        screen.getByRole("button", { name: `Saiba mais sobre ${label}` }),
      );
      expect(screen.getByText(explanation)).toBeVisible();
    }
  });

  it("keeps four compact, decision-oriented indicators in the quick summary", () => {
    renderPage();

    const quickSummary = screen.getByRole("region", {
      name: "Panorama financeiro",
    });

    expect(
      within(quickSummary).getByRole("heading", { name: "Resumo rápido" }),
    ).toBeInTheDocument();
    expect(within(quickSummary).getAllByRole("article")).toHaveLength(4);
    expect(
      within(quickSummary).getByRole("heading", { name: "Ticket médio" }),
    ).toBeInTheDocument();
    expect(
      within(quickSummary).getByRole("heading", {
        name: "Sessões concluídas",
      }),
    ).toBeInTheDocument();
    expect(
      within(quickSummary).queryByRole("heading", { name: "Receita no mês" }),
    ).not.toBeInTheDocument();
  });

  it("uses the canonical payout forecast for the receivable indicator", () => {
    renderPage();

    const receivableCard = screen
      .getByRole("heading", { name: "A receber" })
      .closest("article");

    expect(receivableCard).not.toBeNull();
    expect(receivableCard).toHaveTextContent(/R\$\s*70,00/);
    expect(receivableCard).not.toHaveTextContent(/R\$\s*80,00/);
  });

  it("renders Premium financial metrics and locks the Premium Plus dashboard", () => {
    renderPage();

    expect(
      screen.getAllByRole("heading", { name: "Ticket médio" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Terapias com maior receita").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Evolução financeira").length).toBeGreaterThan(
      0,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /Agenda e potencial.*Premium Plus/i,
      }),
    );
    expect(
      screen.getByRole("link", { name: "Conhecer Premium Plus" }),
    ).toHaveAttribute("href", "/terapeuta/plano");
    expect(
      screen.queryByRole("heading", { name: "Evolução com projeção" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Benchmark anonimizado" }),
    ).not.toBeInTheDocument();
  });

  it("keeps Premium Plus readings in the summary without the advanced accordion", () => {
    renderPage("summary", {
      advanced: {
        dashboard: advancedFixture(),
        status: "available",
      },
      analytics: {
        metrics: {
          ...fixture().analytics.metrics!,
          plan: "premium_plus",
        },
        status: "available",
      },
      overview: {
        ...fixture().overview,
        plan: "premium_plus",
      },
    });

    expect(
      screen.getByRole("heading", { name: "Agenda e potencial" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Terapias com maior receita" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Receita contratada do mês").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Potencial estimado da agenda").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Realizado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Contratado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Período anterior").length).toBeGreaterThan(0);
    expect(screen.queryByText("Estimado")).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/não representa receita garantida/i).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Análises avançadas")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Previsão do mês" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Benchmark anonimizado" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Benchmark suprimido por privacidade estatística/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Dica TES" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the monthly revenue visible when availability is not configured", () => {
    const dashboard = advancedFixture();
    dashboard.agendaPotential = {
      ...dashboard.agendaPotential,
      availableMinutes: 0,
      capacityMinutes: 0,
      committedMinutes: 0,
      occupancyRate: null,
      reason: "no_availability_rules",
      status: "insufficient_data",
    };

    renderPage("summary", {
      advanced: { dashboard, status: "available" },
      analytics: {
        metrics: { ...fixture().analytics.metrics!, plan: "premium_plus" },
        status: "available",
      },
      overview: { ...fixture().overview, plan: "premium_plus" },
    });

    expect(
      screen.getByRole("heading", { name: "Evolução financeira" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Receita contratada do mês")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Agenda e potencial" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Aguardando base suficiente"),
    ).not.toBeInTheDocument();
  });

  it("keeps the financial reading panels free of agenda and sessions shortcuts", () => {
    renderPage("summary", {
      advanced: {
        dashboard: advancedFixture(),
        status: "available",
      },
      analytics: {
        metrics: {
          ...fixture().analytics.metrics!,
          plan: "premium_plus",
        },
        status: "available",
      },
      overview: {
        ...fixture().overview,
        plan: "premium_plus",
      },
    });

    const financialReading = screen.getByRole("region", {
      name: "Agenda e receitas",
    });

    expect(
      within(financialReading).queryByRole("link", { name: "Ver agenda" }),
    ).not.toBeInTheDocument();
    expect(
      within(financialReading).queryByRole("link", {
        name: "Ver como preencher",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(financialReading).queryByRole("link", { name: /sessões/i }),
    ).not.toBeInTheDocument();
  });

  it("prioritizes financial evolution and keeps the methodology discreet", () => {
    renderPage();

    const financialView = screen.getByRole("region", {
      name: "Visão financeira",
    });

    expect(
      within(financialView).getByRole("heading", {
        name: "Evolução financeira",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Como calculamos estes indicadores",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Terapias com maior receita",
      }),
    ).toBeInTheDocument();
    expect(
      within(financialView).queryByRole("link", {
        name: "Ver relatório completo",
      }),
    ).not.toBeInTheDocument();
  });

  it("keeps advanced summary metrics locked for Free therapists", () => {
    renderPage("summary", {
      analytics: {
        metrics: null,
        requiredPlan: "Premium",
        status: "locked",
      },
      overview: {
        ...fixture().overview,
        plan: "free",
      },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: /Panorama financeiro.*Premium/i,
      }),
    );
    expect(
      screen.getByRole("link", { name: "Conhecer Premium" }),
    ).toHaveAttribute("href", "/terapeuta/plano");
    expect(screen.queryByText("Seu dinheiro")).not.toBeInTheDocument();
  });

  it("keeps Recebimentos focused on session charges", () => {
    renderPage("receipts");

    expect(
      screen.getByRole("heading", { name: "Cobranças das suas sessões" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Comissão TES").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pagamento aprovado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lucas").length).toBeGreaterThan(0);
    expect(screen.queryByText("Recebimento por mês")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Distribuição por status"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Custos da plataforma")).not.toBeInTheDocument();
    const chargeSummary = screen.getByLabelText("Resumo das cobranças");
    expect(within(chargeSummary).getAllByRole("link")).toHaveLength(3);
    expect(
      within(chargeSummary).queryByRole("link", { name: /Processando/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Processando" }),
    ).toBeInTheDocument();
  });

  it("shows a fully offset payment as compensated without losing its approved charge", () => {
    const base = fixture();
    const approvedReceipt = base.receipts.items[0]!;

    renderPage("receipts", {
      receipts: {
        ...base.receipts,
        items: [
          {
            ...approvedReceipt,
            receiptStatus: "compensated",
          },
        ],
      },
    });

    expect(screen.getAllByText("Pagamento aprovado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Compensado").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        "Seu valor foi usado para compensar um saldo pendente. Não haverá depósito bancário para esta sessão.",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText("Acompanhe a previsão de chegada em Repasses."),
    ).not.toBeInTheDocument();
  });

  it("shows partial compensation and the residual bank amount separately", () => {
    renderPage("receipts");

    expect(
      screen.getAllByText(
        "R$ 10,00 foram usados para compensar o saldo pendente e R$ 70,00 seguem para sua conta. Acompanhe a chegada em Repasses.",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText(
        "Seu valor foi usado para compensar um saldo pendente. Não haverá depósito bancário para esta sessão.",
      ),
    ).not.toBeInTheDocument();
  });

  it("keeps the generic receipts copy when no charge status is selected", () => {
    renderPage("receipts");

    expect(
      screen.getByRole("heading", { name: "Movimentações por sessão" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Confira o valor da sessão, a Comissão TES, seu valor e a próxima etapa da cobrança.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Movimentações das cobranças por sessão"),
    ).toBeInTheDocument();
  });

  it.each([
    [
      "approved",
      "Sessões com pagamento aprovado",
      "Confira as sessões cuja cobrança foi concluída e acompanhe o valor antes da chegada à sua conta.",
      "Não há sessões com pagamento aprovado neste período.",
    ],
    [
      "processing",
      "Sessões com cobrança em processamento",
      "Confira as sessões cuja cobrança foi iniciada e ainda aguarda conclusão.",
      "Não há sessões com cobrança em processamento neste período.",
    ],
    [
      "scheduled",
      "Sessões com cobrança agendada",
      "Confira as sessões com cobrança prevista antes do atendimento.",
      "Não há sessões com cobrança agendada neste período.",
    ],
    [
      "refunded",
      "Sessões reembolsadas",
      "Confira as sessões cujo valor foi devolvido ao paciente.",
      "Não há sessões reembolsadas neste período.",
    ],
    [
      "canceled",
      "Sessões canceladas",
      "Confira as sessões canceladas. Nenhuma cobrança será feita.",
      "Não há sessões canceladas neste período.",
    ],
    [
      "failed",
      "Sessões com cobrança não concluída",
      "Confira as sessões cuja cobrança não foi concluída.",
      "Não há sessões com cobrança não concluída neste período.",
    ],
    [
      "under_review",
      "Sessões com cobrança em análise",
      "Confira as sessões cuja cobrança está sendo analisada.",
      "Não há sessões com cobrança em análise neste período.",
    ],
  ] as const)(
    "uses contextual receipts copy for the %s charge filter",
    (status, title, subtitle, emptyTitle) => {
      renderPage("receipts", {}, { status });

      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
      expect(screen.getByText(subtitle)).toBeInTheDocument();
      expect(screen.getByLabelText(title)).toBeInTheDocument();

      cleanup();
      const baseReceipts = fixture().receipts;
      renderPage(
        "receipts",
        {
          receipts: {
            ...baseReceipts,
            items: [],
          },
        },
        { status },
      );

      expect(screen.getByText(emptyTitle)).toBeInTheDocument();
      expect(screen.getByText("Limpar filtros")).toBeInTheDocument();
    },
  );

  it("does not offer a receipt for a charge that failed", () => {
    const baseReceipts = fixture().receipts;
    renderPage("receipts", {
      receipts: {
        ...baseReceipts,
        items: [
          {
            ...baseReceipts.items[0],
            chargeStatus: "failed",
            financialStatus: "failed",
          },
        ],
      },
    });

    expect(screen.getAllByText("Falhou").length).toBeGreaterThan(0);
    expect(
      screen.queryByText("Comprovante de pagamento"),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Ver detalhes").length).toBeGreaterThan(0);
  });

  it("preserves receipt filters in pagination and clear-filter links", () => {
    const baseReceipts = fixture().receipts;

    renderPage(
      "receipts",
      {
        receipts: {
          ...baseReceipts,
          pagination: {
            ...baseReceipts.pagination,
            hasNextPage: true,
            totalCount: 13,
            totalPages: 2,
          },
        },
      },
      {
        search: "Lucas",
        status: "canceled",
        therapyId: "therapy-1",
      },
    );

    const loadMore = screen.getByRole("link", { name: "Carregar mais" });
    expect(loadMore).toHaveAttribute(
      "href",
      "/terapeuta/financeiro?tab=recebimentos&page=2&status=canceled&therapyId=therapy-1&q=Lucas",
    );
    expect(
      screen.getByRole("link", { name: "Limpar filtros" }),
    ).toHaveAttribute("href", "/terapeuta/financeiro?tab=recebimentos");
  });

  it("keeps previous and next receipt controls as distinct destinations after loading more", () => {
    const baseReceipts = fixture().receipts;
    const pageOneData = {
      ...fixture(),
      receipts: {
        ...baseReceipts,
        pagination: {
          ...baseReceipts.pagination,
          hasNextPage: true,
          totalCount: 18,
          totalPages: 3,
        },
      },
    };
    const pageTwoData = {
      ...pageOneData,
      receipts: {
        ...pageOneData.receipts,
        pagination: {
          ...pageOneData.receipts.pagination,
          page: 2,
        },
      },
    };
    const filters: TherapistFinanceFilters = {
      agendaDays: 15,
      page: 1,
      payoutStatus: null,
      search: null,
      status: null,
      therapyId: null,
    };
    const dateRange: TherapistFinanceDateRange = {
      end: "2026-07-28",
      key: "30",
      start: "2026-06-29",
    };
    const rendered = render(
      <TherapistFinancePage
        data={pageOneData}
        dateRange={dateRange}
        filters={filters}
        tab="receipts"
      />,
    );

    expect(screen.queryByRole("link", { name: "Mostrar menos" })).toBeNull();
    expect(screen.getByRole("link", { name: "Carregar mais" })).toHaveAttribute(
      "href",
      "/terapeuta/financeiro?tab=recebimentos&page=2",
    );

    rendered.rerender(
      <TherapistFinancePage
        data={pageTwoData}
        dateRange={dateRange}
        filters={{ ...filters, page: 2 }}
        tab="receipts"
      />,
    );

    expect(screen.getByRole("link", { name: "Mostrar menos" })).toHaveAttribute(
      "href",
      "/terapeuta/financeiro?tab=recebimentos",
    );
    const nextPage = screen.getByRole("link", { name: "Carregar mais" });
    expect(nextPage).toHaveAttribute(
      "href",
      "/terapeuta/financeiro?tab=recebimentos&page=3",
    );
    expect(within(nextPage).getByText("Carregar mais")).toHaveAttribute(
      "aria-busy",
      "false",
    );
  });

  it("does not render a local bank-data form for Connect", () => {
    renderPage("account", {
      account: {
        ...fixture().account,
        accountExists: false,
        onboardingStatus: "not_started",
      },
    });

    expect(
      screen.getByRole("heading", {
        name: "Conecte sua conta de recebimento",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Conectar conta de recebimento" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/agência/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^conta$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/pix/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/cpf/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/cnpj/i)).not.toBeInTheDocument();
  });

  it("asks for a new receiving account after the prior account is closed", () => {
    renderPage("account", {
      account: {
        ...fixture().account,
        accountExists: false,
        maskedAccountId: null,
        onboardingStatus: "not_started",
        previousAccountClosed: true,
      },
    });

    expect(
      screen.getByRole("heading", { name: "Conta de recebimento pendente" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Criar nova conta de recebimento" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Sua conta de recebimento anterior foi encerrada. Crie uma nova conta para que os pr\u00f3ximos repasses possam continuar.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/prÃ³ximos repasses/i)).not.toBeInTheDocument();
    expect(screen.queryByText("acct_...cdef")).not.toBeInTheDocument();
  });

  it("shows only the three product states in the payout summary", () => {
    renderPage("payouts");

    const summary = screen.getByRole("region", { name: "Resumo dos repasses" });
    expect(
      within(summary)
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(["A receber", "A caminho da sua conta", "Recebido no período"]);
  });

  it("orders upcoming payouts with in-transit values before predictions", () => {
    renderPage("payouts");

    const agenda = screen
      .getByRole("heading", { name: "Próximos repasses" })
      .closest("section");
    expect(agenda).not.toBeNull();
    expect(agenda!.textContent!.indexOf("A caminho da sua conta")).toBeLessThan(
      agenda!.textContent!.indexOf("Próximos previstos"),
    );
    expect(within(agenda!).queryByText("Recebido em")).not.toBeInTheDocument();
    expect(
      within(agenda!).getByText("As datas previstas podem mudar."),
    ).toBeInTheDocument();
  });

  it("keeps received values in history and technical terms out of the page", () => {
    const { container } = renderPage("payouts");

    expect(
      screen.getByRole("heading", { name: "Histórico de repasses" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Recebido").length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(
      /próximo lote|transfer|payout|balance transaction|concilia|Stripe/i,
    );
  });

  it("offers 7, 15 and 30 days and keeps 15 days selected by default", () => {
    renderPage("payouts");

    expect(screen.getByRole("link", { name: "7 dias" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "15 dias" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "30 dias" })).toBeInTheDocument();
  });

  it("offers a typed custom date range in the summary", () => {
    renderPage();

    expect(screen.queryByLabelText("De")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Até")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Período"), {
      target: { value: "custom" },
    });
    expect(screen.getByLabelText("De")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Até")).toHaveAttribute("type", "date");
    fireEvent.change(screen.getByLabelText("Período"), {
      target: { value: "90" },
    });
    expect(screen.queryByLabelText("De")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Até")).not.toBeInTheDocument();
  });

  it.each(["receipts", "payouts"] as const)(
    "shows custom date inputs in the %s filters and hides them for preset periods",
    (tab) => {
      renderPage(
        tab,
        {},
        {},
        {
          end: "2026-08-31",
          key: "custom",
          start: "2026-08-01",
        },
      );

      const periodLabel =
        tab === "payouts" ? "Período do histórico" : "Período";
      expect(screen.getByLabelText(periodLabel)).toHaveValue("custom");
      expect(screen.getByLabelText("De")).toHaveValue("2026-08-01");
      expect(screen.getByLabelText("Até")).toHaveValue("2026-08-31");

      fireEvent.change(screen.getByLabelText(periodLabel), {
        target: { value: "90" },
      });
      expect(screen.queryByLabelText("De")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Até")).not.toBeInTheDocument();
    },
  );
});

function renderPage(
  tab: "account" | "payouts" | "receipts" | "summary" = "summary",
  overrides: Partial<TherapistFinancePageData> = {},
  filtersOverride: Partial<TherapistFinanceFilters> = {},
  dateRange: TherapistFinanceDateRange = {
    end: "2026-07-28",
    key: "30",
    start: "2026-06-29",
  },
) {
  const data = { ...fixture(), ...overrides };

  return render(
    <TherapistFinancePage
      data={data}
      dateRange={dateRange}
      filters={{
        agendaDays: 15,
        page: 1,
        payoutStatus: null,
        search: null,
        status: null,
        therapyId: null,
        ...filtersOverride,
      }}
      tab={tab}
    />,
  );
}

function fixture(): TherapistFinancePageData {
  return {
    account: {
      accountExists: true,
      chargesEnabled: false,
      contractVersion: 1,
      currentlyDue: [],
      detailsSubmitted: true,
      disabledReason: null,
      eventuallyDue: [],
      generatedAt: "2026-07-28T12:00:00.000Z",
      lastSyncedAt: "2026-07-28T11:00:00.000Z",
      maskedAccountId: "acct_...cdef",
      maskedBankAccountSummary: null,
      onboardingStatus: "ready",
      payoutsEnabled: true,
      pendingVerification: [],
      previousAccountClosed: false,
      therapistProfileId: "c1000000-0000-4000-8000-000000000001",
      transferCapabilityStatus: "active",
    },
    advanced: {
      dashboard: null,
      requiredPlan: "Premium Plus",
      status: "locked",
    },
    analytics: {
      metrics: {
        contractVersion: 2,
        financialEvolution: [
          {
            grossAmountCents: 10000,
            periodEnd: "2026-07-05",
            periodStart: "2026-06-29",
            previousPeriodNetAmountCents: 5000,
            therapistNetAmountCents: 7000,
          },
        ],
        metricDefinitionVersion: 2,
        period: {
          end: "2026-07-28",
          generatedAt: "2026-07-28T12:00:00.000Z",
          isPartial: true,
          previousEnd: "2026-06-28",
          previousStart: "2026-05-30",
          start: "2026-06-29",
          timezone: "America/Sao_Paulo",
        },
        plan: "premium",
        retention: {
          eligiblePatients: 10,
          minimumEligiblePatients: 10,
          observationWindowDays: 90,
          returningPatients: 6,
          returnRate: 60,
          status: "available",
        },
        revenue: {
          comparison: {
            averageTicket: {
              absoluteDelta: 2000,
              comparisonStatus: "available",
              currentValue: 7000,
              percentageDelta: 40,
              previousValue: 5000,
            },
            grossPaid: {
              absoluteDelta: 3000,
              comparisonStatus: "available",
              currentValue: 10000,
              percentageDelta: 42.9,
              previousValue: 7000,
            },
            paidSessions: {
              absoluteDelta: 1,
              comparisonStatus: "available",
              currentValue: 1,
              percentageDelta: 100,
              previousValue: 0,
            },
            therapistNet: {
              absoluteDelta: 2000,
              comparisonStatus: "available",
              currentValue: 7000,
              percentageDelta: 40,
              previousValue: 5000,
            },
          },
          grossAverageTicketCents: 10000,
          grossPaidCents: 10000,
          netAverageTicketCents: 7000,
          paidSessionCount: 1,
          therapistNetCents: 7000,
        },
        revenueByTherapy: [
          {
            averageTicketCents: 10000,
            grossAmountCents: 10000,
            paidSessionCount: 1,
            therapistNetAmountCents: 7000,
            therapyId: "therapy-1",
            therapyNameSnapshot: "Reiki",
          },
        ],
        sessions: {
          cancellationRate: 10,
          cancelledCount: 1,
          completedCount: 1,
          eligibleScheduledCount: 10,
          rescheduleRate: 20,
          rescheduledCount: 2,
        },
        therapistProfileId: "c1000000-0000-4000-8000-000000000001",
      },
      status: "available",
    },
    overview: {
      blockedCents: 0,
      contractVersion: 3,
      disputedCents: 0,
      eligibleForPayoutCents: 8000,
      generatedAt: "2026-07-28T12:00:00.000Z",
      grossPaidCents: 10000,
      payoutProcessingCents: 0,
      processingCents: 8000,
      receivedCents: 0,
      periodEnd: "2026-07-28",
      periodStart: "2026-06-29",
      plan: "premium",
      refundedToCustomersCents: 1000,
      tesCommissionCents: 2000,
      therapistNetCents: 7000,
      therapistProfileId: "c1000000-0000-4000-8000-000000000001",
      timezone: "America/Sao_Paulo",
      transferredCents: 8000,
      waitingConfirmationCents: 0,
      waitingSafetyPeriodCents: 0,
      waitingSettlementCents: 0,
    },
    payouts: {
      agenda: {
        awaitingBankDate: [],
        balanceAvailable: [],
        days: 15,
        inTransit: [
          {
            amountCents: 8000,
            composition: [
              {
                amountCents: 8000,
                bookingId: "booking-1",
                patientDisplayName: "Lucas",
                sessionDate: "2026-07-28T13:00:00.000Z",
                sessionPaymentId: "payment-1",
                therapyNameSnapshot: "Reiki",
              },
            ],
            date: "2026-07-30",
            id: "in-transit:2026-07-30",
            sessionCount: 1,
            status: "in_transit",
          },
        ],
        periodEnd: "2026-08-11",
        periodStart: "2026-07-28",
        predicted: [
          {
            amountCents: 7000,
            composition: [
              {
                amountCents: 7000,
                bookingId: "booking-2",
                patientDisplayName: "Marina",
                sessionDate: "2026-07-29T13:00:00.000Z",
                sessionPaymentId: "payment-2",
                therapyNameSnapshot: "Reiki",
              },
            ],
            date: "2026-08-01",
            id: "predicted:2026-08-01",
            sessionCount: 1,
            status: "predicted",
          },
        ],
      },
      contractVersion: 7,
      filters: {
        agendaDays: 15,
        periodEnd: "2026-07-28",
        periodStart: "2026-06-29",
        timezone: "America/Sao_Paulo",
      },
      generatedAt: "2026-07-28T12:00:00.000Z",
      historyItems: [
        {
          amountCents: 8000,
          composition: [
            {
              amountCents: 8000,
              bookingId: "booking-1",
              patientDisplayName: "Lucas",
              sessionDate: "2026-07-28T13:00:00.000Z",
              sessionPaymentId: "payment-1",
              therapyNameSnapshot: "Reiki",
            },
          ],
          date: "2026-07-27",
          id: "received:2026-07-27",
          sessionCount: 1,
          status: "received",
        },
      ],
      pagination: {
        hasNextPage: false,
        page: 1,
        pageSize: 12,
        totalCount: 1,
        totalPages: 1,
      },
      summary: {
        expectedCents: 7000,
        inTransitCents: 8000,
        receivedCents: 8000,
      },
      therapistProfileId: "c1000000-0000-4000-8000-000000000001",
    },
    receipts: {
      contractVersion: 5,
      filters: {
        periodEnd: "2026-07-28",
        periodStart: "2026-06-29",
        search: null,
        status: null,
        therapyId: null,
        timezone: "America/Sao_Paulo",
      },
      generatedAt: "2026-07-28T12:00:00.000Z",
      items: [
        {
          bankTransferAmountCents: 7000,
          bookingId: "booking-1",
          chargeStatus: "approved",
          createdAt: "2026-07-28T12:00:00.000Z",
          debtOffsetAmountCents: 1000,
          financialStatus: "paid",
          grossAmountCents: 10000,
          patientDisplayName: "Lucas",
          receiptUrl: "https://stripe.test/receipt",
          receiptStatus: "bank_pending",
          refundedAmountCents: 0,
          scheduledChargeAt: null,
          sessionDate: "2026-07-28T13:00:00.000Z",
          sessionPaymentId: "payment-1",
          tesCommissionCents: 2000,
          therapistNetAmountCents: 7000,
          therapyNameSnapshot: "Reiki",
        },
      ],
      pagination: {
        hasNextPage: false,
        page: 1,
        pageSize: 12,
        totalCount: 1,
        totalPages: 1,
      },
      summary: {
        approvedCents: 7000,
        processingCents: 0,
        refundedCents: 0,
        scheduledCents: 0,
      },
      therapistProfileId: "c1000000-0000-4000-8000-000000000001",
      therapyOptions: [{ name: "Reiki", therapyId: "therapy-1" }],
    },
  };
}

function advancedFixture(): TherapistAdvancedFinancialDashboard {
  return {
    agendaPotential: {
      availableMinutes: 420,
      capacityMinutes: 720,
      committedMinutes: 180,
      confidence: "medium",
      conservativePotentialCents: 48000,
      estimatedBookableSlots: 6,
      expectedPotentialCents: 60000,
      maximumPotentialCents: 72000,
      methodologyVersion: "tes-agenda-potential-v1",
      occupancyRate: 25,
      reason: null,
      status: "available",
      windowEnd: "2026-07-31",
      windowStart: "2026-07-28",
    },
    benchmark: {
      cohortDescription: null,
      methodologyVersion: "tes-financial-benchmark-v1",
      metrics: {
        averageTicketCents: {
          cohortMedian: null,
          percentile: null,
          therapistValue: 10000,
        },
        occupancyRate: {
          cohortMedian: null,
          percentile: null,
          therapistValue: 25,
        },
        returnRate: {
          cohortMedian: null,
          percentile: null,
          therapistValue: 60,
        },
      },
      minimumSessions: 100,
      minimumTherapists: 20,
      sampleSize: null,
      status: "insufficient_sample",
    },
    contractVersion: 2,
    financialEvolution: [
      {
        contractedNetCents: 8000,
        periodEnd: "2026-07-05",
        periodStart: "2026-06-29",
        previousPeriodNetCents: 5000,
        projectedNetCents: 14000,
        realizedNetCents: 7000,
      },
    ],
    forecast: {
      confidence: "medium",
      contractedFutureNetCents: 8000,
      contractedMonthNetCents: 15000,
      estimatedOpenAgendaPotentialCents: 60000,
      methodologyVersion: "tes-financial-forecast-v1",
      realizedNetCents: 7000,
      reason: null,
      status: "available",
      totalEstimatedPotentialCents: 75000,
    },
    insights: {
      items: [
        {
          action: "open_agenda",
          code: "agenda_open_potential",
          evidence: [
            {
              metric: "availableMinutes",
              periodEnd: "2026-07-31",
              periodStart: "2026-07-28",
              value: 420,
            },
          ],
          explanation:
            "Há horários online disponíveis que podem receber novas reservas.",
          generatedAt: "2026-07-28T12:00:00.000Z",
          methodologyVersion: "tes-financial-opportunities-v1",
          title: "Potencial disponível da agenda",
        },
      ],
      methodologyVersion: "tes-financial-opportunities-v1",
      status: "available",
    },
    methodologies: [
      {
        description: "Separa realizado, contratado e estimado.",
        version: "tes-financial-forecast-v1",
      },
    ],
    opportunities: {
      items: [
        {
          action: "open_agenda",
          code: "agenda_open_potential",
          confidence: "medium",
          description:
            "Há horários online disponíveis que podem receber novas reservas.",
          estimatedImpactCents: 60000,
          evidence: [
            {
              metric: "availableMinutes",
              periodEnd: "2026-07-31",
              periodStart: "2026-07-28",
              value: 420,
            },
          ],
          generatedAt: "2026-07-28T12:00:00.000Z",
          methodologyVersion: "tes-financial-opportunities-v1",
          title: "Potencial disponível da agenda",
        },
      ],
      methodologyVersion: "tes-financial-opportunities-v1",
      primary: {
        action: "open_agenda",
        code: "agenda_open_potential",
        confidence: "medium",
        description:
          "Há horários online disponíveis que podem receber novas reservas.",
        estimatedImpactCents: 60000,
        evidence: [
          {
            metric: "availableMinutes",
            periodEnd: "2026-07-31",
            periodStart: "2026-07-28",
            value: 420,
          },
        ],
        generatedAt: "2026-07-28T12:00:00.000Z",
        methodologyVersion: "tes-financial-opportunities-v1",
        title: "Potencial disponível da agenda",
      },
      status: "available",
    },
    period: {
      end: "2026-07-28",
      forecastMonthEnd: "2026-07-31",
      forecastMonthStart: "2026-07-01",
      generatedAt: "2026-07-28T12:00:00.000Z",
      isPartial: true,
      previousEnd: "2026-06-28",
      previousStart: "2026-05-30",
      start: "2026-06-29",
      timezone: "America/Sao_Paulo",
    },
    plan: "premium_plus",
    retention: {
      cohorts: [
        {
          censoredPatients: 1,
          cohortMonth: "2026-07-01",
          newPatients: 3,
          returnRate: 50,
          returningPatients: 1,
          withoutReturnPatients: 1,
        },
      ],
      eligiblePatients: 10,
      medianDaysToReturn: 21,
      methodologyVersion: "tes-retention-v1",
      minimumEligiblePatients: 10,
      observationWindowsDays: [30, 60, 90],
      primaryWindowDays: 90,
      returningPatients: 6,
      returnRate: 60,
      status: "available",
      withoutReturnPatients: 4,
    },
    revenueByTherapy: [
      {
        averageTicketCents: 10000,
        grossAmountCents: 10000,
        paidSessionCount: 1,
        revenueSharePercent: 100,
        therapistNetAmountCents: 7000,
        therapyId: "therapy-1",
        therapyNameSnapshot: "Reiki",
        trend: {
          absoluteDelta: 2000,
          comparisonStatus: "available",
          currentValue: 7000,
          percentageDelta: 40,
          previousValue: 5000,
        },
      },
    ],
    therapistProfileId: "c1000000-0000-4000-8000-000000000001",
  };
}
