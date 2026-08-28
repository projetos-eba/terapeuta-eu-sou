import { EmailProviderError } from "./errors.ts";
import { HostingerMailApiProvider } from "./hostinger-mail-api-provider.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

Deno.test(
  "HostingerMailApiProvider uses bearer auth and parses send result",
  async () => {
    let authorization = "";
    const requestBodies: Record<string, unknown>[] = [];
    const provider = new HostingerMailApiProvider({
      apiKey: "secret-test-key",
      fetcher: (_input, init) => {
        authorization = new Headers(init?.headers).get("authorization") ?? "";
        requestBodies.push(
          JSON.parse(String(init?.body)) as Record<string, unknown>,
        );
        return Promise.resolve(new Response(null, { status: 204 }));
      },
    });

    const result = await provider.send({
      correlationId: "corr",
      from: {
        displayName: "TES",
        mailboxAddress: "contato@example.test",
        mailboxResourceId: "mailbox-1",
      },
      html: "<p>ok</p>",
      subject: "Teste",
      text: "ok",
      to: { email: "pessoa@example.test" },
    });

    assertEquals(authorization, "Bearer secret-test-key");
    assertEquals(requestBodies[0]?.displayName, "TES");
    assertEquals("display_name" in (requestBodies[0] ?? {}), false);
    assertEquals(requestBodies[0]?.html, "<p>ok</p>");
    assertEquals("text" in (requestBodies[0] ?? {}), false);
    assertEquals(
      JSON.stringify(requestBodies[0]?.to),
      JSON.stringify(["pessoa@example.test"]),
    );
    assertEquals(result.messageId, null);
  },
);

Deno.test("HostingerMailApiProvider retries transient responses", async () => {
  let calls = 0;
  const provider = new HostingerMailApiProvider({
    apiKey: "secret-test-key",
    fetcher: () => {
      calls += 1;
      return Promise.resolve(
        calls === 1
          ? jsonResponse({ error: "slow" }, 429, { "retry-after": "0" })
          : new Response(null, { status: 204 }),
      );
    },
  });

  const result = await provider.send({
    correlationId: "corr",
    from: {
      displayName: "TES",
      mailboxAddress: "contato@example.test",
      mailboxResourceId: "mailbox-1",
    },
    html: "<p>ok</p>",
    subject: "Teste",
    text: "ok",
    to: { email: "pessoa@example.test" },
  });

  assertEquals(calls, 2);
  assertEquals(result.attemptCount, 2);
});

Deno.test(
  "HostingerMailApiProvider does not retry an ambiguous network failure",
  async () => {
    let calls = 0;
    const provider = new HostingerMailApiProvider({
      apiKey: "secret-test-key",
      fetcher: () => {
        calls += 1;
        return Promise.reject(new TypeError("network unavailable"));
      },
    });

    try {
      await provider.send({
        correlationId: "corr",
        from: {
          displayName: "TES",
          mailboxAddress: "contato@example.test",
          mailboxResourceId: "mailbox-1",
        },
        html: "<p>ok</p>",
        subject: "Teste",
        text: "ok",
        to: { email: "pessoa@example.test" },
      });
      throw new Error("Expected provider failure.");
    } catch (error) {
      assert(error instanceof EmailProviderError);
      if (error instanceof EmailProviderError) {
        assertEquals(error.deliveryOutcome, "unknown");
        assertEquals(error.retryable, false);
      }
      assertEquals(calls, 1);
    }
  },
);

Deno.test(
  "HostingerMailApiProvider parses current account mailboxes",
  async () => {
    const provider = new HostingerMailApiProvider({
      apiKey: "secret-test-key",
      fetcher: () =>
        Promise.resolve(
          jsonResponse({
            data: {
              mailboxes: [
                {
                  address: "contato@example.test",
                  resource_id: "mailbox-1",
                },
              ],
            },
          }),
        ),
    });

    const senders = await provider.listSenders();

    assertEquals(senders.length, 1);
    assertEquals(senders[0]?.displayName, "TES - Terapeuta Eu Sou");
    assertEquals(senders[0]?.mailboxAddress, "contato@example.test");
    assertEquals(senders[0]?.mailboxResourceId, "mailbox-1");
  },
);

Deno.test(
  "HostingerMailApiProvider preserves a sender name returned by Hostinger",
  async () => {
    const provider = new HostingerMailApiProvider({
      apiKey: "secret-test-key",
      fetcher: () =>
        Promise.resolve(
          jsonResponse({
            data: {
              mailboxes: [
                {
                  address: "contato@example.test",
                  display_name: "Hostinger configured name",
                  resource_id: "mailbox-1",
                },
              ],
            },
          }),
        ),
    });

    const senders = await provider.listSenders();

    assertEquals(senders[0]?.displayName, "Hostinger configured name");
  },
);

Deno.test(
  "HostingerMailApiProvider does not retry validation errors",
  async () => {
    let calls = 0;
    const provider = new HostingerMailApiProvider({
      apiKey: "secret-test-key",
      fetcher: () => {
        calls += 1;
        return Promise.resolve(jsonResponse({ error: "invalid" }, 422));
      },
    });

    try {
      await provider.listSenders();
      throw new Error("Expected provider failure.");
    } catch (error) {
      assert(error instanceof EmailProviderError);
      if (error instanceof EmailProviderError) {
        assertEquals(error.code, "unprocessable");
      }
      assertEquals(calls, 1);
    }
  },
);

Deno.test(
  "HostingerMailApiProvider preserves HTTP status for non JSON errors",
  async () => {
    const provider = new HostingerMailApiProvider({
      apiKey: "secret-test-key",
      fetcher: () =>
        Promise.resolve(new Response("unauthorized", { status: 401 })),
    });

    try {
      await provider.listSenders();
      throw new Error("Expected provider failure.");
    } catch (error) {
      assert(error instanceof EmailProviderError);
      if (error instanceof EmailProviderError) {
        assertEquals(error.code, "unauthorized");
        assertEquals(error.status, 401);
      }
    }
  },
);

function jsonResponse(
  body: unknown,
  status = 200,
  headers?: Record<string, string>,
) {
  return new Response(JSON.stringify(body), { headers, status });
}

function assert(value: unknown) {
  if (!value) {
    throw new Error("Assertion failed.");
  }
}

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(
      `Expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}
