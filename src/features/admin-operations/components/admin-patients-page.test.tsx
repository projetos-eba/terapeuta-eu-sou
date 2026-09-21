import { renderToStaticMarkup } from "react-dom/server";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AdminOperationDetailPageData,
  AdminOperationPageData,
} from "../admin-operations.types";
import { mapAdminOperationDetail } from "../admin-operations.mappers";
import { AdminPatientsPage } from "./admin-patients-page";
import { AdminPatientDetailPage } from "./admin-patient-detail-page";
import {
  AdminOperationCommandPanel,
  getCommandOptions,
} from "./admin-operation-command-panel";
import { formatPhone, formatPostalCode } from "./admin-private-contact-details";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockReset();
});

const detail = (status = "active"): AdminOperationDetailPageData =>
  mapAdminOperationDetail({
    module: "patients",
    auditEvents: [],
    generatedAt: "2026-09-18T12:00:00Z",
    record: {
      id: "11111111-1111-4111-8111-111111111111",
      user_id: "hidden-user-id",
      display_name: "Cliente Teste",
      account_status: status,
      booking_management_available: true,
      timezone: "America/Sao_Paulo",
      created_at: "2026-09-01T12:00:00Z",
      updated_at: "2026-09-18T12:00:00Z",
      booking_count: 3,
      future_booking_count: 1,
      ticket_count: 2,
      private_contact: {
        email: "cliente@example.test",
        phone: "11987654321",
        phoneCountryCode: "55",
        postalCode: "01001000",
        street: "Praça da Sé",
        streetNumber: "10",
        city: "São Paulo",
        state: "SP",
        secret: "must-not-appear",
        metadata: { private: "must-not-appear" },
      },
    },
  });

function page(
  overrides: Partial<AdminOperationPageData> = {},
): AdminOperationPageData {
  return {
    title: "Clientes",
    description: "",
    emptyMessage: "Nenhum cliente disponível.",
    generatedAt: "2026-09-18T12:00:00Z",
    listHref: "/admin/pacientes",
    safetyNotes: [],
    sourceLabel: "Clientes",
    filterOptions: {
      sort: [{ label: "Mais recentes", value: "recent" }],
      status: [{ label: "Suspensos", value: "suspended" }],
    },
    page: { hasNext: false, page: 1, pageSize: 12, total: 0 },
    query: { page: 1, pageSize: 12, search: "", sort: "recent", status: "" },
    rows: [],
    rowsStatus: "available",
    metrics: [
      { key: "total-patients", value: 100, tone: "info" as const },
      {
        key: "recent-patients",
        value: 20,
        comparisonValue: 10,
        tone: "success" as const,
      },
      {
        key: "active-patients",
        value: 80,
        percentage: 80,
        tone: "success" as const,
      },
      { key: "suspended-patients", value: 5, tone: "warning" as const },
    ].map((item) => ({
      description: "",
      label: "",
      source: "patients",
      status: "available",
      ...item,
    })),
    ...overrides,
  };
}

describe("Clientes ADM", () => {
  it.runIf(process.env.ADMIN_CLIENTS_VISUAL_QA === "1")(
    "checks the real components with isolated fixtures and TES CSS at three viewports",
    async () => {
      const { readFileSync } = await import("node:fs");
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
      const browser = await chromium.launch({
        channel: "msedge",
        headless: false,
      });
      try {
        const browserPage = await browser.newPage();
        const data = page({
          rows: [
            {
              id: "fixture-client",
              title: "Cliente Teste",
              detailHref: "/admin/pacientes/fixture-client",
              fields: [
                { label: "Status", value: "active" },
                { label: "Reservas", value: "3" },
                { label: "Chamados", value: "2" },
              ],
            },
          ],
          page: { page: 1, pageSize: 12, total: 1, hasNext: false },
        });
        for (const width of [1440, 1024, 390]) {
          await browserPage.setViewportSize({ width, height: 900 });
          for (const [name, html] of [
            ["list", renderToStaticMarkup(<AdminPatientsPage data={data} />)],
            [
              "detail",
              renderToStaticMarkup(<AdminPatientDetailPage data={detail()} />),
            ],
          ]) {
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
                `test-results/admin-clients-component-qa/${name}-${width}.png`,
              ),
              fullPage: true,
            });
          }
        }
        render(<AdminPatientDetailPage data={detail()} />);
        fireEvent.change(screen.getByRole("textbox", { name: "Motivo" }), {
          target: { value: "Verificação visual sem executar suspensão" },
        });
        fireEvent.click(
          screen.getByRole("button", { name: "Suspender novos agendamentos" }),
        );
        await screen.findByRole("dialog");
        const dialogHtml = document.body.innerHTML;
        for (const width of [1440, 1024, 390]) {
          await browserPage.setViewportSize({ width, height: 900 });
          await browserPage.setContent(
            `<!doctype html><html lang="pt-BR"><head><style>${css}</style></head><body><div class="tes-authenticated-surface px-4 py-6">${dialogHtml}</div></body></html>`,
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
              `test-results/admin-clients-component-qa/confirmation-${width}.png`,
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
  it("renders four authoritative compact indicators, growth and share", () => {
    const html = renderToStaticMarkup(<AdminPatientsPage data={page()} />);
    for (const title of [
      "Total de clientes",
      "Novos cadastros",
      "Contas ativas",
      "Clientes suspensos",
    ])
      expect(html).toContain(title);
    expect(html).toContain("+100%");
    expect(html).toContain("80% do total");
    expect(html).not.toContain("Recorrência");
    expect(html).not.toContain("Média por cliente");
  });
  it("does not invent a growth comparison when the previous period is empty", () => {
    const data = page();
    data.metrics[1].comparisonValue = 0;
    expect(renderToStaticMarkup(<AdminPatientsPage data={data} />)).toContain(
      "Sem base de comparação",
    );
  });
  it("does not turn unavailable metrics into zero", () => {
    render(
      <AdminPatientsPage
        data={page({ metrics: [], rowsStatus: "unavailable" })}
      />,
    );
    expect(
      screen.getAllByText("Indicador indisponível no momento."),
    ).toHaveLength(4);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
  it("renders registered contacts and creation date without internal IDs or extra metadata", () => {
    const data = detail();
    const html = renderToStaticMarkup(<AdminPatientDetailPage data={data} />);
    for (const text of [
      "cliente@example.test",
      "+55 (11) 98765-4321",
      "01001-000",
      "Praça da Sé",
      "Na plataforma desde",
      "01/09/2026",
      "Não informado",
    ])
      expect(html).toContain(text);
    expect(html).not.toContain("hidden-user-id");
    expect(html).not.toContain(data.id);
    expect(JSON.stringify(data.patientContact)).not.toContain(
      "must-not-appear",
    );
    expect(data.statusLabel).toBe("active");
  });
  it("keeps a missing projection distinct from optional missing contact fields", () => {
    const data = detail();
    data.patientContact = null;
    expect(
      renderToStaticMarkup(<AdminPatientDetailPage data={data} />),
    ).toContain("Não foi possível carregar os dados de contato");
  });
  it("does not infer a missing client phone country code", () => {
    const data = detail();
    data.patientContact!.phoneCountryCode = null;
    const html = renderToStaticMarkup(<AdminPatientDetailPage data={data} />);
    expect(html).toContain("11987654321");
    expect(html).toContain("DDI");
    expect(html).toContain("Não informado");
    expect(html).not.toContain("+55");
  });
  it.each(["deleted", "anonymized"])(
    "does not offer mutations for a %s account",
    (status) => {
      expect(getCommandOptions(detail(status))).toEqual([]);
    },
  );
  it("offers reactivation and explains the scope of suspension", () => {
    render(<AdminPatientDetailPage data={detail("suspended")} />);
    expect(
      screen.getByRole("button", { name: "Reativar agendamentos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Login, suporte e sessões já contratadas permanecem disponíveis/,
      ),
    ).toBeInTheDocument();
  });
  it("requires reason and confirmation before submitting a suspension", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true, data: {} })));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminOperationCommandPanel data={detail()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo" }), {
      target: { value: "Motivo administrativo válido" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Suspender novos agendamentos" }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/Somente novos agendamentos serão bloqueados/),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Suspender novos agendamentos" }),
    );
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Confirmar",
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      action: "patient.suspend",
      entityId: detail().id,
      reason: "Motivo administrativo válido",
    });
  });
  it("formats legacy and international phones without changing stored values", () => {
    expect(formatPhone(null, "11987654321")).toBe("+55 (11) 98765-4321");
    expect(formatPhone(null, "11987654321", null)).toBe("11987654321");
    expect(formatPhone("55", "1133334444")).toBe("+55 (11) 3333-4444");
    expect(formatPhone("44", "2071234567")).toBe("+44 2071234567");
    expect(formatPhone("55", null)).toBe("");
    expect(formatPostalCode("01001-000")).toBe("01001-000");
    expect(formatPostalCode("SW1A 1AA")).toBe("SW1A 1AA");
  });
  it("keeps the same request ID when retrying an uncertain client command", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network timeout"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, data: {} })),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminOperationCommandPanel data={detail()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo" }), {
      target: { value: "Motivo administrativo válido" },
    });
    const confirm = async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Suspender novos agendamentos" }),
      );
      fireEvent.click(
        within(await screen.findByRole("dialog")).getByRole("button", {
          name: "Confirmar",
        }),
      );
    };
    await confirm();
    await screen.findByText(
      "Não foi possível conectar agora. Tente novamente.",
    );
    fireEvent.keyDown(document, { key: "Escape" });
    await confirm();
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).requestId).toBe(
      JSON.parse(fetchMock.mock.calls[1][1].body).requestId,
    );
  });
  it("requires a reason before displaying confirmation", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminOperationCommandPanel data={detail()} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Suspender novos agendamentos" }),
    );
    expect(
      await screen.findByText("Informe um motivo com pelo menos 8 caracteres."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirmar" }),
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not offer unwired mutations when the server has not enabled the booking-management contract", () => {
    const data = detail();
    data.canManagePatientBookings = false;
    expect(getCommandOptions(data)).toEqual([]);
    render(<AdminPatientDetailPage data={data} />);
    expect(
      screen.queryByRole("button", { name: "Suspender novos agendamentos" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "A gestão de agendamentos está indisponível no momento.",
      ),
    ).toBeInTheDocument();
  });
});
