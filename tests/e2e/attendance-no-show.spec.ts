import { expect, test } from "@playwright/test";
import path from "node:path";
import type { ViteDevServer } from "vite";

// Actual therapist page/Admin detail/patient waiting room; server boundaries
// simulated in isolation. Every non-local request is blocked.
let server: ViteDevServer;
let origin: string;
test.beforeAll(async () => {
  const { createServer } = await import("vite");
  const { default: react } = await import("@vitejs/plugin-react");
  const boundaries = path.resolve(
    "tests/e2e/fixtures/attendance-no-show-boundaries.tsx",
  );
  server = await createServer({
    configFile: false,
    envDir: false,
    define: { "process.env": "{}" },
    plugins: [
      react(),
      {
        name: "isolated-attendance",
        configureServer(vite) {
          vite.middlewares.use(async (req, res, next) => {
            if (!req.url?.startsWith("/attendance-harness")) return next();
            res.setHeader("Content-Type", "text/html");
            res.end(
              await vite.transformIndexHtml(
                "/attendance-harness",
                '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/attendance-no-show-entry.tsx"></script></body></html>',
              ),
            );
          });
        },
      },
    ],
    resolve: {
      alias: [
        ...[
          "next/link",
          "next/navigation",
          "@/lib/auth/therapist-session",
          "@/features/therapist-shell",
          "@/features/therapist-sessions",
          "@/features/session-actions/session-delay-notice.queries",
        ].map((name) => ({
          find: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
          replacement: boundaries,
        })),
        {
          find: "next/image",
          replacement: path.resolve(
            "tests/e2e/fixtures/zoom-preview-image.tsx",
          ),
        },
        { find: "@", replacement: path.resolve("src") },
      ],
    },
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === "string")
    throw new Error("local harness unavailable");
  origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  await server?.close();
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  for (const role of ["patient", "therapist", "admin"]) {
    test(`${role}: therapist absence at ${viewport.width}px`, async ({
      page,
      context,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await context.route("**/*", (route) =>
        new URL(route.request().url()).origin === origin
          ? route.continue()
          : route.abort(),
      );
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${origin}/attendance-harness?role=${role}`);
      if (role === "patient") {
        await expect(
          page.getByText("Encontro não realizado", { exact: true }),
        ).toBeVisible();
        await expect(page.getByText(/terapeuta não compareceu/i)).toBeVisible();
        await expect(page.getByRole("button", { name: /entrar/i })).toHaveCount(
          0,
        );
        await expect(
          page.getByText("Entrar na sala", { exact: true }),
        ).toHaveCount(0);
        await expect(page.getByText(/sala ficará disponível/i)).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: /Testar (câmera|áudio)/ }),
        ).toHaveCount(0);
      } else if (role === "therapist") {
        await expect(
          page
            .getByRole("link", { name: "Relatar ocorrência", exact: true })
            .first(),
        ).toBeVisible();
        await expect(
          page.getByRole("link", { name: "Confirmar sessão", exact: true }),
        ).toHaveCount(0);
        await expect(
          page
            .getByText("Sessão não realizada — terapeuta não compareceu", {
              exact: true,
            })
            .first(),
        ).toBeVisible();
        await expect(
          page.getByText("Confirmado", { exact: true }).first(),
        ).toBeVisible();
      } else {
        await expect(
          page
            .getByText("Acesso bloqueado — encerramento pendente", {
              exact: true,
            })
            .first(),
        ).toBeVisible();
        await expect(
          page.getByText("Financeiro — independente da confirmação", {
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page.getByText("Pago", { exact: true }).first(),
        ).toBeVisible();
        await expect(
          page.getByText(/avaliação de qualidade indisponível/i),
        ).toBeVisible();
        await expect(
          page.getByText(/Pendente: o cliente e o terapeuta/i),
        ).toHaveCount(0);
        await expect(
          page.getByText("Pronta para iniciar", { exact: true }),
        ).toHaveCount(0);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      expect(errors).toEqual([]);
      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(`${role}-${viewport.width}.png`),
      });
    });
  }
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
]) {
  for (const role of ["patient", "therapist"]) {
    for (const stage of ["open", "overdue", "answered"]) {
      test(`${role}: quality ${stage} at ${viewport.width}px`, async ({
        page,
        context,
      }) => {
        await page.setViewportSize(viewport);
        await context.route("**/*", (route) =>
          new URL(route.request().url()).origin === origin
            ? route.continue()
            : route.abort(),
        );
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(
          `${origin}/attendance-harness?role=quality-state-${role}&stage=${stage}`,
        );
        await expect(
          page.getByRole("heading", {
            name:
              stage === "answered"
                ? "Realizada (confirmada)"
                : "Realizada, em análise",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page.getByText(
            `Sua confirmação individual permanece pendente. Prazo automático: ${role === "patient" ? 7 : 30} dias após o horário final previsto.`,
            { exact: true },
          ),
        ).toBeVisible();
        await expect(
          page.getByRole("link", { name: "Acompanhar meu relato no suporte" }),
        ).toHaveAttribute(
          "href",
          `${role === "patient" ? "/app" : "/terapeuta"}/suporte/own-private-ticket`,
        );
        if (stage === "overdue")
          await expect(
            page.getByText(/O prazo de 5 dias do TES venceu/),
          ).toBeVisible();
        if (stage === "open")
          await expect(
            page.getByText(/em até 5 dias corridos após o relato/),
          ).toBeVisible();
        if (stage === "answered")
          await expect(
            page.getByText(/em até 5 dias corridos após o relato/),
          ).toHaveCount(0);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        expect(errors).toEqual([]);
      });
    }
  }
  test(`Admin: performed quality audit at ${viewport.width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize(viewport);
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin
        ? route.continue()
        : route.abort(),
    );
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/attendance-harness?role=quality-admin`);
    await expect(
      page.getByText("Realizada, em análise", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/Análise de qualidade: somente auditoria/),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Responder no ticket vinculado" }),
    ).toHaveAttribute("href", "/admin/suporte/quality-ticket");
    await expect(
      page.getByRole("button", { name: /reembolso|reagendamento/i }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
  for (const scenario of [
    { role: "quality-patient", successful: true },
    { role: "quality-therapist", successful: true },
    { role: "quality-therapist", successful: false },
  ]) {
    test(`${scenario.role}: quality feedback ${scenario.successful ? "positive" : "negative"} at ${viewport.width}px`, async ({
      page,
      context,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await context.route("**/*", (route) =>
        new URL(route.request().url()).origin === origin
          ? route.continue()
          : route.abort(),
      );
      const submitted: Record<string, unknown>[] = [];
      let savedFeedback: Record<string, unknown> | null = null;
      const publicReviews: Record<string, unknown>[] = [];
      await page.route("**/api/patient/reviews**", async (route) => {
        const isPost = route.request().method() === "POST";
        if (isPost) publicReviews.push(route.request().postDataJSON());
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: isPost
              ? {
                  review: {
                    id: "review-fixture",
                    rating: 4,
                    comment: "",
                    status: "published",
                  },
                }
              : {
                  eligible: true,
                  review: null,
                  therapistProfileId: "therapist-fixture",
                },
          }),
        });
      });
      await page.route("**/api/session-feedback**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              data: {
                contractVersion: 2,
                sessionAttemptId: "f2000000-0000-4000-8000-000000000088",
                actorRole:
                  scenario.role === "quality-patient" ? "patient" : "therapist",
                realizationStatus: "performed",
                confirmation: null,
                counterpartConfirmation: null,
                status: savedFeedback ? "submitted" : "eligible",
                feedback: savedFeedback,
              },
            }),
          });
          return;
        }
        const body = route.request().postDataJSON() as Record<string, unknown>;
        submitted.push(body);
        savedFeedback = {
          id: "f2000000-0000-4000-8000-000000000089",
          authorRole: body.actorRole,
          successful: body.successful,
          rating: body.rating,
          qualityReason: body.qualityReason,
          comment: body.comment,
        };
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              feedback: {
                id: "f2000000-0000-4000-8000-000000000089",
                successful: body.successful,
                rating: body.rating,
                qualityReason: body.qualityReason,
                comment: body.comment,
              },
            },
          }),
        });
      });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${origin}/attendance-harness?role=${scenario.role}`);
      await expect(
        page.getByText("Essa sessão foi bem-sucedida?", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: scenario.successful ? "Sim" : "Não",
          exact: true,
        })
        .click();
      if (scenario.successful) {
        await expect(
          page.getByRole("radiogroup", { name: "Nota de 1 a 5" }),
        ).toBeVisible();
        await page.getByRole("button", { name: "5 estrelas" }).click();
        await expect(page.getByText("Problema de internet")).toHaveCount(0);
      } else {
        await expect(
          page.getByRole("radiogroup", { name: "Nota de 1 a 5" }),
        ).toHaveCount(0);
        await expect(page.getByText("Sessão remarcada")).toHaveCount(0);
        await expect(
          page.getByText("Cancelamento em cima da hora"),
        ).toHaveCount(0);
        await page.getByLabel("Problema de internet").check();
      }
      await page.getByRole("button", { name: "Enviar feedback" }).click();
      await expect(
        page.getByText("Sua avaliação foi registrada"),
      ).toBeVisible();
      expect(submitted).toHaveLength(1);
      expect(submitted[0]).toMatchObject({
        contractVersion: 2,
        sessionAttemptId: "f2000000-0000-4000-8000-000000000088",
        successful: scenario.successful,
        rating: scenario.successful ? 5 : null,
        qualityReason: scenario.successful ? null : "internet_problem",
      });
      if (scenario.role === "quality-patient") {
        await page
          .getByRole("button", { name: "Avaliar terapeuta (opcional)" })
          .click();
        await expect(
          page.getByRole("heading", {
            name: "Avaliar Terapeuta de teste publicamente",
          }),
        ).toBeVisible();
        expect(publicReviews).toHaveLength(0);
        await page.screenshot({
          path: testInfo.outputPath("optional-therapist-review.png"),
          fullPage: true,
        });
        await page.getByRole("button", { name: "4 estrelas" }).click();
        await page.getByRole("button", { name: "Publicar avaliação" }).click();
        await expect(
          page.getByText("Avaliação publicada no perfil do terapeuta."),
        ).toBeVisible();
        expect(publicReviews).toHaveLength(1);
        expect(publicReviews[0]).toMatchObject({
          therapistProfileId: "therapist-fixture",
          rating: 4,
        });
        expect(submitted).toHaveLength(1);
        await page.reload();
        await expect(
          page.getByText("Sua avaliação foi registrada"),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Enviar feedback" }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: "Avaliar terapeuta (opcional)" }),
        ).toBeVisible();
      } else {
        await expect(
          page.getByRole("button", { name: "Avaliar terapeuta (opcional)" }),
        ).toHaveCount(0);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}
