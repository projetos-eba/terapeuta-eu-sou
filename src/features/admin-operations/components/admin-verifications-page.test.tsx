import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AdminOperationPageData } from "../admin-operations.types";
import { AdminVerificationsPage } from "./admin-verifications-page";

describe("AdminVerificationsPage", () => {
  it.runIf(process.env.ADMIN_VERIFICATIONS_VISUAL_QA === "1")(
    "keeps the verification queue responsive with the TES styles at three viewports",
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
          <AdminVerificationsPage
            data={pageData({ statusLabel: "Em análise" })}
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
              `test-results/admin-verifications-component-qa/list-${width}.png`,
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

  it("keeps approval pending publication in the purple operational state", () => {
    const html = renderToStaticMarkup(
      <AdminVerificationsPage
        data={pageData({
          statusLabel: "Aprovado · falta publicar",
        })}
      />,
    );

    expect(html).toContain("Aprovado · falta publicar");
    expect(html).toContain("bg-brand-lavenderSoft text-brand-primary");
    expect(html).not.toContain("bg-status-successBg text-status-success");
  });

  it("uses green only for a profile that is public and eligible", () => {
    const html = renderToStaticMarkup(
      <AdminVerificationsPage
        data={pageData({ statusLabel: "Publicado e elegível" })}
      />,
    );

    expect(html).toContain("Publicado e elegível");
    expect(html).toContain("bg-status-successBg text-status-success");
  });

  it("groups identity below the professional name and preserves the review action", () => {
    const html = renderToStaticMarkup(
      <AdminVerificationsPage
        data={pageData({ statusLabel: "Em análise" })}
      />,
    );

    expect(html).toContain("<table");
    [
      "Profissional",
      "Data de cadastro",
      "Situação",
      "Pendência",
      "Última movimentação",
      "Ação",
    ].forEach((label) => expect(html).toContain(label));
    expect(html).toContain("ana.oliveira@example.test");
    expect(html).toContain("ID: #TER-0001");
    expect(html.indexOf("ID: #TER-0001")).toBeLessThan(
      html.indexOf("ana.oliveira@example.test"),
    );
    expect(html).toContain("Abrir análise");
    expect(html).not.toContain("Como funciona a revisão");
    expect(html).not.toMatch(/<th[^>]*>E-mail<\/th>/);
    expect(html).not.toMatch(/<th[^>]*>ID do terapeuta<\/th>/);
    expect(html).not.toContain("Enviado em");
  });
});

function pageData({ statusLabel }: { statusLabel: string }): AdminOperationPageData {
  return {
    description: "",
    emptyMessage: "",
    filterOptions: {
      sort: [{ label: "Mais recentes", value: "recent" }],
      status: [{ label: "Todos os status", value: "" }],
    },
    generatedAt: "2026-09-16T12:00:00.000Z",
    listHref: "/admin/profissionais/verificacoes",
    metrics: [],
    page: {
      hasNext: false,
      page: 1,
      pageSize: 10,
      total: 1,
    },
    query: {
      page: 1,
      pageSize: 10,
      search: "",
      sort: "recent",
      status: "",
    },
    rows: [
      {
        detailHref: "/admin/profissionais/therapist-1",
        email: "ana.oliveira@example.test",
        fields: [
          { label: "ID do terapeuta", value: "#TER-0001" },
          { label: "Data de cadastro", value: "12/09/2026" },
          { label: "Pendência", value: "Documentos profissionais" },
          { label: "Última movimentação", value: "16/09/2026, 09:20" },
        ],
        id: "verification-1",
        statusLabel,
        title: "Terapeuta 01",
      },
    ],
    rowsStatus: "available",
    safetyNotes: [],
    sourceLabel: "Supabase",
    title: "Verificações",
  };
}
