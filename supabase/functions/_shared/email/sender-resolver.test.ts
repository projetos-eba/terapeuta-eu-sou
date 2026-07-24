import { EmailConfigurationError, EmailSkippedError } from "./errors.ts";
import { resolveSender } from "./sender-resolver.ts";
import type { SenderProfileRow } from "./types.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

const sender: SenderProfileRow = {
  active: true,
  display_name: "TES",
  id: "sender-1",
  is_default: false,
  mailbox_address: "contato@example.test",
  mailbox_resource_id: "mailbox-1",
  provider: "hostinger_mail_api",
  reply_to_email: null,
};

Deno.test("resolveSender prefers specific active sender", async () => {
  const resolved = await resolveSender(fakeClient([[{
    action_key: "email_verification",
    enabled: true,
    sender_profile_id: sender.id,
    email_sender_profiles: sender,
  }]]), "email_verification");

  assertEquals(resolved.id, sender.id);
});

Deno.test("resolveSender skips disabled actions", async () => {
  try {
    await resolveSender(fakeClient([[{
      action_key: "email_verification",
      enabled: false,
      sender_profile_id: null,
      email_sender_profiles: null,
    }]]), "email_verification");
    throw new Error("Expected skip.");
  } catch (error) {
    assert(error instanceof EmailSkippedError);
  }
});

Deno.test("resolveSender falls back to default sender", async () => {
  const defaultSender = { ...sender, id: "sender-default", is_default: true };
  const resolved = await resolveSender(
    fakeClient([[], [defaultSender]]),
    "password_reset",
  );

  assertEquals(resolved.id, "sender-default");
});

Deno.test("resolveSender errors without sender", async () => {
  try {
    await resolveSender(fakeClient([[], []]), "password_reset");
    throw new Error("Expected configuration error.");
  } catch (error) {
    assert(error instanceof EmailConfigurationError);
  }
});

function fakeClient(responses: unknown[][]) {
  let index = 0;

  return {
    async get<T>() {
      const response = responses[index] ?? [];
      index += 1;
      return response as T;
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
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}.`);
  }
}
