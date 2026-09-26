import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AdminOperationPageData } from "../admin-operations.types";
import { AdminOperationalOverviewPage } from "./admin-operational-overview-page";

const baseData: AdminOperationPageData = {
  description: "",
  emptyMessage: "",
  filterOptions: {
    sort: [{ label: "Mais recentes", value: "recent" }],
    status: [{ label: "Todos", value: "" }],
  },
  generatedAt: "2026-08-11T12:00:00.000Z",
  listHref: "/admin/sessoes",
  metrics: [
    {
      description: "Reservas registradas.",
      key: "total-sessions",
      label: "Sessões",
      source: "bookings",
      status: "available",
      tone: "info",
      value: 4,
    },
  ],
  page: { hasNext: false, page: 1, pageSize: 10, total: 1 },
  query: { page: 1, pageSize: 10, search: "", sort: "recent", status: "" },
  rows: [
    {
      detailHref: "/admin/sessoes/session-1",
      fields: [
        { label: "Terapeuta", value: "Ana Oliveira" },
        { label: "Cliente", value: "Marina Rocha" },
        { label: "Pagamento", value: "paid" },
        { label: "Início", value: "11/08/2026, 14:00" },
        { label: "Duração", value: "50 min" },
      ],
      id: "session-1",
      statusLabel: "confirmed",
      subtitle: "Booking session-1",
      title: "Aromaterapia",
    },
  ],
  rowsStatus: "available",
  safetyNotes: [],
  sourceLabel: "bookings",
  title: "Sessões",
};

describe("AdminOperationalOverviewPage", () => {
  it.runIf(process.env.ADMIN_SESSIONS_VISUAL_QA === "1")(
    "keeps the sessions workspace legible at desktop, tablet and mobile widths",
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
          <AdminOperationalOverviewPage data={baseData} module="sessions" />,
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
              `test-results/admin-sessions-component-qa/list-${width}.png`,
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

  it("renders the sessions workspace without technical list copy", () => {
    const html = renderToStaticMarkup(
      <AdminOperationalOverviewPage data={baseData} module="sessions" />,
    );

    expect(html).toContain("Agenda de sessões");
    expect(html).toContain("Ana Oliveira");
    expect(html).toContain("ID: session-1");
    expect(html).not.toContain("Booking session-1");
    expect(html).not.toContain("bookings");
  });

  it("uses semantic session icons without changing the status labels", () => {
    const html = renderToStaticMarkup(
      <AdminOperationalOverviewPage
        data={{
          ...baseData,
          metrics: [
            ...baseData.metrics,
            {
              ...baseData.metrics[0],
              key: "future-sessions",
              label: "Futuras",
              value: 2,
            },
            {
              ...baseData.metrics[0],
              key: "attention-sessions",
              label: "Atenção",
              tone: "warning",
              value: 1,
            },
          ],
          rows: [
            {
              ...baseData.rows[0],
              statusLabel: "cancelled_by_patient",
            },
          ],
        }}
        module="sessions"
      />,
    );

    expect(html).toContain("lucide-calendar-days");
    expect(html).toContain("lucide-calendar-clock");
    expect(html).toContain("lucide-circle-alert");
    expect(html).toContain("lucide-credit-card");
    expect(html).toContain("lucide-calendar-x2");
    expect(html).toContain("Cancelada pelo cliente");
  });

  it("normalizes booking and payment enums only in the admin presentation", () => {
    const html = renderToStaticMarkup(
      <AdminOperationalOverviewPage
        data={{
          ...baseData,
          rows: [
            {
              ...baseData.rows[0],
              fields: baseData.rows[0].fields.map((field) =>
                field.label === "Pagamento"
                  ? { ...field, value: "cancelled" }
                  : field,
              ),
              statusLabel: "cancelled_by_payment",
            },
            {
              ...baseData.rows[0],
              id: "session-2",
              statusLabel: "no_show_patient",
            },
            {
              ...baseData.rows[0],
              id: "session-3",
              statusLabel: "draft",
            },
          ],
        }}
        module="sessions"
      />,
    );

    expect(html).toContain("Cancelada por falha no pagamento");
    expect(html).toContain("Não realizada — cliente ausente");
    expect(html).toContain("Pagamento: Cancelado");
    expect(html).toContain("Rascunho");
    expect(html).not.toContain("Cancelled by payment");
    expect(html).not.toContain("No show patient");
    expect(html).not.toContain("Perfil em construção");
  });

  it("renders the support workspace with module-specific language", () => {
    const html = renderToStaticMarkup(
      <AdminOperationalOverviewPage
        data={{
          ...baseData,
          listHref: "/admin/suporte",
          rows: [],
          title: "Suporte",
        }}
        module="support"
      />,
    );

    expect(html).toContain("Fila de atendimento");
    expect(html).toContain("Nenhuma solicitação encontrada");
    expect(html).not.toContain("sessão administrativa atual");
  });
});
