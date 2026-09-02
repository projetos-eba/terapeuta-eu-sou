import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const password = "tes-mock-password";
const reservationUrl =
  "/reserva?duration=50&price=17000" +
  "&service=d1000000-0000-4000-8000-000000000001" +
  "&therapist=ana-oliveira" +
  "&slot=2026-09-02T13%3A00%3A00.000Z";

type CheckoutResponse = {
  checkout?: {
    bookingId: string;
    checkoutSessionId: string;
    mode: "initial_hold" | "payment_retry";
    reservationExpiresAt: string | null;
  };
  ok: boolean;
};

async function loginPatient(page: Page, email: string) {
  await page.goto(`/cliente/login?next=${encodeURIComponent(reservationUrl)}`);
  await page.getByLabel("E-mail").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/reserva\?/);
}

async function assertBeforeCheckout(page: Page) {
  await expect(
    page.getByText(/Seu horário está reservado por mais/i),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Escolha o seu melhor momento" }),
  ).toBeVisible();
}

test("grants one five-minute initial hold when two patients race", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const contexts: BrowserContext[] = [];

  try {
    const firstContext = await browser.newContext();
    const secondContext = await browser.newContext();
    contexts.push(firstContext, secondContext);
    const firstPage = await firstContext.newPage();
    const secondPage = await secondContext.newPage();

    await Promise.all([
      loginPatient(firstPage, "paciente.ana@example.test"),
      loginPatient(secondPage, "paciente.rafael@example.test"),
    ]);
    await Promise.all([
      assertBeforeCheckout(firstPage),
      assertBeforeCheckout(secondPage),
    ]);

    const runCheckout = async (page: Page) => {
      const response = await page.request.post(
        "/api/public/reservation/checkout",
        {
          data: {
            action: "create",
            checkoutAttemptId: crypto.randomUUID(),
            serviceId: "d1000000-0000-4000-8000-000000000001",
            sharedNote: null,
            startsAt: "2026-09-02T13:00:00.000Z",
            termsAccepted: true,
          },
        },
      );
      return {
        body: (await response.json()) as CheckoutResponse,
        page,
        status: response.status(),
      };
    };

    const results = await Promise.all([
      runCheckout(firstPage),
      runCheckout(secondPage),
    ]);
    const winners = results.filter(
      (result) => result.status === 200 && result.body.ok,
    );
    const losers = results.filter((result) => !result.body.ok);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0]?.status).toBe(409);
    expect(winners[0]?.body.checkout?.mode).toBe("initial_hold");
    expect(winners[0]?.body.checkout?.reservationExpiresAt).not.toBeNull();
    await expect(
      losers[0]!.page.getByText(/Seu horário está reservado por mais/i),
    ).toHaveCount(0);

    const checkout = winners[0]!.body.checkout!;
    const abandonResponse = await winners[0]!.page.request.post(
      "/api/public/reservation/abandon",
      {
        data: {
          bookingId: checkout.bookingId,
          checkoutSessionId: checkout.checkoutSessionId,
          reason: "reservation_abandoned",
          requestId: crypto.randomUUID(),
        },
      },
    );
    expect(abandonResponse.ok()).toBe(true);
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
});
