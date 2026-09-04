import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const password = "tes-mock-password";
const nextWeek = new Date();
nextWeek.setUTCDate(
  nextWeek.getUTCDate() + ((10 - nextWeek.getUTCDay()) % 7 || 7),
);
const reservationUrl =
  "/reserva?duration=50&price=12000" +
  "&service=d1000000-0000-4000-8000-000000000001" +
  "&therapist=ana-oliveira" +
  `&date=${nextWeek.toISOString().slice(0, 10)}`;

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
  baseURL,
  browser,
}) => {
  test.setTimeout(90_000);
  const contexts: BrowserContext[] = [];

  try {
    const firstContext = await browser.newContext({ baseURL });
    const secondContext = await browser.newContext({ baseURL });
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

    // Select an actually published slot that is free for both authenticated
    // patients, rather than a fixed date or a slot consumed by a prior test.
    const slotsFor = (page: Page) =>
      page
        .locator('a[href*="slot="]')
        .evaluateAll((links) =>
          links.map((link) =>
            new URL((link as HTMLAnchorElement).href).searchParams.get("slot"),
          ),
        );
    const [firstSlots, secondSlots] = await Promise.all([
      slotsFor(firstPage),
      slotsFor(secondPage),
    ]);
    const startsAt = firstSlots.find(
      (slot) => slot && secondSlots.includes(slot),
    );
    expect(
      startsAt,
      "a published slot free for both test patients",
    ).toBeTruthy();

    const runCheckout = async (page: Page) => {
      const response = await page.request.post(
        "/api/public/reservation/checkout",
        {
          data: {
            action: "create",
            checkoutAttemptId: crypto.randomUUID(),
            serviceId: "d1000000-0000-4000-8000-000000000001",
            sharedNote: null,
            startsAt,
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
    const remaining =
      Date.parse(winners[0]!.body.checkout!.reservationExpiresAt!) - Date.now();
    expect(remaining).toBeGreaterThan(240_000);
    expect(remaining).toBeLessThanOrEqual(300_000);
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
