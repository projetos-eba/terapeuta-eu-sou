import {
  getServiceRoleKey,
  getSiteUrl,
  isLocalMasterPasswordBypassEnabled,
  parseBooleanEnv,
} from "./runtime.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

Deno.test("parseBooleanEnv defaults absent and empty values to false", () => {
  assertEquals(parseBooleanEnv(undefined), false);
  assertEquals(parseBooleanEnv(""), false);
  assertEquals(parseBooleanEnv("   "), false);
});

Deno.test("parseBooleanEnv accepts only explicit boolean strings", () => {
  assertEquals(parseBooleanEnv(" true "), true);
  assertEquals(parseBooleanEnv("FALSE"), false);
});

Deno.test("parseBooleanEnv rejects invalid values", () => {
  try {
    parseBooleanEnv("1");
    throw new Error("Expected parser failure.");
  } catch (error) {
    assert(error instanceof Error);
    if (error instanceof Error) {
      assertEquals(error.message, "INVALID_BOOLEAN_ENV");
    }
  }
});

Deno.test(
  "getServiceRoleKey prefers injected service role on local Supabase",
  () => {
    const key = getServiceRoleKey({
      env: {
        get(name) {
          return {
            SUPABASE_SECRET_KEYS: '{"default":"sb_secret_remote"}',
            SUPABASE_SERVICE_ROLE_KEY: "header.payload.signature",
            SUPABASE_URL: "http://127.0.0.1:54321",
          }[name];
        },
      },
      serve() {
        return undefined;
      },
    });

    assertEquals(key, "header.payload.signature");
  },
);

Deno.test(
  "getServiceRoleKey prefers secret keys away from local Supabase",
  () => {
    const key = getServiceRoleKey({
      env: {
        get(name) {
          return {
            SUPABASE_SECRET_KEYS: '{"default":"sb_secret_remote"}',
            SUPABASE_SERVICE_ROLE_KEY: "header.payload.signature",
            SUPABASE_URL: "https://project.supabase.co",
          }[name];
        },
      },
      serve() {
        return undefined;
      },
    });

    assertEquals(key, "sb_secret_remote");
  },
);

Deno.test("getSiteUrl ignores empty configured values", () => {
  const url = getSiteUrl({
    env: {
      get(name) {
        return {
          EMAIL_PUBLIC_SITE_URL: " ",
          NEXT_PUBLIC_SITE_URL: "https://terapeutaeusou.com.br/",
        }[name];
      },
    },
    serve() {
      return undefined;
    },
  });

  assertEquals(url, "https://terapeutaeusou.com.br");
});

Deno.test("getSiteUrl normalizes hostnames without protocol", () => {
  const publicUrl = getSiteUrl({
    env: {
      get(name) {
        return {
          EMAIL_PUBLIC_SITE_URL: "terapeutaeusou.com.br/",
        }[name];
      },
    },
    serve() {
      return undefined;
    },
  });
  const localUrl = getSiteUrl({
    env: {
      get(name) {
        return {
          EMAIL_PUBLIC_SITE_URL: "localhost:3000/",
        }[name];
      },
    },
    serve() {
      return undefined;
    },
  });

  assertEquals(publicUrl, "https://terapeutaeusou.com.br");
  assertEquals(localUrl, "http://localhost:3000");
});

Deno.test("master password bypass requires explicit local configuration", () => {
  assertEquals(
    isLocalMasterPasswordBypassEnabled(mockRuntime({
      MASTER_PASSWORD_BYPASS_ENABLED: "true",
      SUPABASE_URL: "http://127.0.0.1:54321",
    })),
    true,
  );
  assertEquals(
    isLocalMasterPasswordBypassEnabled(mockRuntime({
      MASTER_PASSWORD_BYPASS_ENABLED: "true",
      SUPABASE_URL: "https://hml-project.supabase.co",
    })),
    false,
  );
  assertEquals(
    isLocalMasterPasswordBypassEnabled(mockRuntime({
      MASTER_PASSWORD_BYPASS_ENABLED: "true",
      SUPABASE_URL: "https://production-project.supabase.co",
    })),
    false,
  );
  assertEquals(
    isLocalMasterPasswordBypassEnabled(mockRuntime({
      SUPABASE_URL: "http://localhost:54321",
    })),
    false,
  );
});

function mockRuntime(values: Record<string, string | undefined>) {
  return {
    env: {
      get(name: string) {
        return values[name];
      },
    },
    serve() {
      return undefined;
    },
  };
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
