import {
  AuthLoginEmailUnconfirmedError,
  AuthLoginSupabaseError,
  loginWithPasswordOrMaster,
} from "./login.ts";
import type { SupabaseRestClient } from "./supabase-rest.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

Deno.test(
  "loginWithPasswordOrMaster accepts the registered password first",
  async () => {
    const restoreFetch = stubFetch([
      jsonResponse({
        access_token: "normal-access",
        expires_in: 3600,
        refresh_token: "normal-refresh",
        user: {
          email_confirmed_at: "2026-07-24T00:00:00.000Z",
          id: "user-1",
        },
      }),
    ]);
    const client = mockClient({
      getRows: [
        [
          {
            email: "ana@example.com",
            email_confirmed_at: "2026-07-24T00:00:00.000Z",
            id: "user-1",
            role: "therapist",
          },
        ],
      ],
    });

    try {
      const session = await loginWithPasswordOrMaster({
        client,
        email: "ana@example.com",
        expectedRole: "therapist",
        masterPassword: "master-secret",
        password: "registered-password",
        publicApiKey: "publishable-key",
        supabaseUrl: "http://127.0.0.1:54321",
      });

      assertEquals(session.accessToken, "normal-access");
      assertEquals(session.refreshToken, "normal-refresh");
    } finally {
      restoreFetch();
    }
  },
);

Deno.test(
  "loginWithPasswordOrMaster accepts the master password after password grant fails",
  async () => {
    const restoreFetch = stubFetch([
      textResponse(401, '{"error":"invalid_grant"}'),
      jsonResponse({
        access_token: "master-access",
        expires_in: 3600,
        refresh_token: "master-refresh",
        user: {
          email_confirmed_at: "2026-07-24T00:00:00.000Z",
          id: "user-1",
        },
      }),
    ]);
    const client = mockClient({
      getRows: [
        [
          {
            email: "ana@example.com",
            email_confirmed_at: "2026-07-24T00:00:00.000Z",
            id: "user-1",
            role: "therapist",
          },
        ],
        {
          email: "ana@example.com",
          email_confirmed_at: "2026-07-24T00:00:00.000Z",
          id: "user-1",
        },
      ],
      postRows: [
        {
          properties: {
            hashed_token: "token-hash",
          },
          user: {
            id: "user-1",
          },
        },
      ],
    });

    try {
      const session = await loginWithPasswordOrMaster({
        client,
        email: "ana@example.com",
        expectedRole: "therapist",
        masterPasswordBypassEnabled: true,
        masterPassword: "master-secret",
        password: "master-secret",
        publicApiKey: "publishable-key",
        supabaseUrl: "http://127.0.0.1:54321",
      });

      assertEquals(session.accessToken, "master-access");
      assertEquals(session.refreshToken, "master-refresh");
    } finally {
      restoreFetch();
    }
  },
);

Deno.test(
  "loginWithPasswordOrMaster accepts master password for admin role",
  async () => {
    const restoreFetch = stubFetch([
      textResponse(401, '{"error":"invalid_grant"}'),
      jsonResponse({
        access_token: "admin-access",
        expires_in: 3600,
        refresh_token: "admin-refresh",
        user: {
          email_confirmed_at: "2026-07-24T00:00:00.000Z",
          id: "admin-1",
        },
      }),
    ]);
    const client = mockClient({
      getRows: [
        [
          {
            email: "admin@example.com",
            email_confirmed_at: "2026-07-24T00:00:00.000Z",
            id: "admin-1",
            role: "admin",
          },
        ],
        {
          email: "admin@example.com",
          email_confirmed_at: "2026-07-24T00:00:00.000Z",
          id: "admin-1",
        },
      ],
      postRows: [
        {
          properties: {
            hashed_token: "admin-token-hash",
          },
          user: {
            id: "admin-1",
          },
        },
      ],
    });

    try {
      const session = await loginWithPasswordOrMaster({
        client,
        email: "admin@example.com",
        expectedRole: "admin",
        masterPasswordBypassEnabled: true,
        masterPassword: "master-secret",
        password: "master-secret",
        publicApiKey: "publishable-key",
        supabaseUrl: "http://127.0.0.1:54321",
      });

      assertEquals(session.accessToken, "admin-access");
      assertEquals(session.userId, "admin-1");
    } finally {
      restoreFetch();
    }
  },
);

Deno.test(
  "loginWithPasswordOrMaster rejects master password when bypass is disabled",
  async () => {
    const restoreFetch = stubFetch([textResponse(401, '{"error":"invalid"}')]);
    const client = mockClient({});

    try {
      await assertRejects(
        () =>
          loginWithPasswordOrMaster({
            client,
            email: "admin@example.com",
            expectedRole: "admin",
            masterPassword: "master-secret",
            masterPasswordBypassEnabled: false,
            password: "master-secret",
            publicApiKey: "publishable-key",
            supabaseUrl: "http://127.0.0.1:54321",
          }),
        AuthLoginSupabaseError,
      );
    } finally {
      restoreFetch();
    }
  },
);

Deno.test(
  "loginWithPasswordOrMaster rejects wrong master password",
  async () => {
    const restoreFetch = stubFetch([textResponse(401, '{"error":"invalid"}')]);
    const client = mockClient({});

    try {
      await assertRejects(
        () =>
          loginWithPasswordOrMaster({
            client,
            email: "ana@example.com",
            expectedRole: "therapist",
            masterPassword: "master-secret",
            password: "wrong-password",
            publicApiKey: "publishable-key",
            supabaseUrl: "http://127.0.0.1:54321",
          }),
        AuthLoginSupabaseError,
      );
    } finally {
      restoreFetch();
    }
  },
);

Deno.test(
  "loginWithPasswordOrMaster rejects a configured master password when bypass is omitted",
  async () => {
    const restoreFetch = stubFetch([textResponse(401, '{"error":"invalid"}')]);
    const client = mockClient({});

    try {
      await assertRejects(
        () =>
          loginWithPasswordOrMaster({
            client,
            email: "ana@example.com",
            expectedRole: "patient",
            masterPassword: "test-only-master",
            password: "test-only-master",
            publicApiKey: "publishable-key",
            supabaseUrl: "https://production-project.supabase.co",
          }),
        AuthLoginSupabaseError,
      );
    } finally {
      restoreFetch();
    }
  },
);

Deno.test(
  "loginWithPasswordOrMaster rejects bypass when the master password is absent",
  async () => {
    const restoreFetch = stubFetch([textResponse(401, '{"error":"invalid"}')]);
    const client = mockClient({});

    try {
      await assertRejects(
        () =>
          loginWithPasswordOrMaster({
            client,
            email: "ana@example.com",
            expectedRole: "therapist",
            masterPasswordBypassEnabled: true,
            password: "test-only-master",
            publicApiKey: "publishable-key",
            supabaseUrl: "http://127.0.0.1:54321",
          }),
        AuthLoginSupabaseError,
      );
    } finally {
      restoreFetch();
    }
  },
);

Deno.test(
  "loginWithPasswordOrMaster maps Supabase email_not_confirmed to a confirmation error",
  async () => {
    const restoreFetch = stubFetch([
      textResponse(
        400,
        '{"code":400,"error_code":"email_not_confirmed","msg":"Email not confirmed"}',
        {
          "x-sb-error-code": "email_not_confirmed",
        },
      ),
    ]);
    const client = mockClient({});

    try {
      await assertRejects(
        () =>
          loginWithPasswordOrMaster({
            client,
            email: "ana@example.com",
            expectedRole: "therapist",
            masterPassword: "master-secret",
            password: "registered-password",
            publicApiKey: "publishable-key",
            supabaseUrl: "http://127.0.0.1:54321",
          }),
        AuthLoginEmailUnconfirmedError,
      );
    } finally {
      restoreFetch();
    }
  },
);

Deno.test(
  "loginWithPasswordOrMaster does not bypass unconfirmed email with master password",
  async () => {
    const restoreFetch = stubFetch([textResponse(401, '{"error":"invalid"}')]);
    const client = mockClient({
      getRows: [
        [
          {
            email: "ana@example.com",
            email_confirmed_at: null,
            id: "user-1",
            role: "therapist",
          },
        ],
        {
          email: "ana@example.com",
          email_confirmed_at: null,
          id: "user-1",
        },
      ],
    });

    try {
      await assertRejects(
        () =>
          loginWithPasswordOrMaster({
            client,
            email: "ana@example.com",
            expectedRole: "therapist",
            masterPasswordBypassEnabled: true,
            masterPassword: "master-secret",
            password: "master-secret",
            publicApiKey: "publishable-key",
            supabaseUrl: "http://127.0.0.1:54321",
          }),
        AuthLoginEmailUnconfirmedError,
      );
    } finally {
      restoreFetch();
    }
  },
);

function mockClient(input: { getRows?: unknown[]; postRows?: unknown[] }) {
  const getRows = [...(input.getRows ?? [])];
  const postRows = [...(input.postRows ?? [])];

  return {
    get: () => getRows.shift(),
    post: () => postRows.shift(),
  } as unknown as SupabaseRestClient;
}

function stubFetch(responses: Response[]) {
  const originalFetch = globalThis.fetch;
  const queue = [...responses];

  globalThis.fetch = (() => {
    const response = queue.shift();

    if (!response) {
      throw new Error("Unexpected fetch call.");
    }

    return Promise.resolve(response);
  }) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

function textResponse(
  status: number,
  value: string,
  headers?: Record<string, string>,
) {
  return new Response(value, { headers, status });
}

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(
      `Expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}

async function assertRejects(
  fn: () => Promise<unknown>,
  expectedError: new (...args: never[]) => Error,
) {
  try {
    await fn();
  } catch (error) {
    if (error instanceof expectedError) {
      return;
    }

    throw new Error(
      `Expected ${expectedError.name}, received ${String(error)}.`,
    );
  }

  throw new Error(`Expected ${expectedError.name}, but no error was thrown.`);
}
