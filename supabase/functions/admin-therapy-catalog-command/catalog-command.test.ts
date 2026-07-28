import { assertEquals, assertThrows } from "jsr:@std/assert";

import { DomainError } from "../_shared/payments/http.ts";
import { validateAdminTherapyCatalogCommand } from "./catalog-command.ts";

const requestId = "11111111-1111-4111-8111-111111111111";
const therapyId = "22222222-2222-4222-8222-222222222222";

Deno.test("accepts admin catalog listing", () => {
  assertEquals(validateAdminTherapyCatalogCommand({ action: "list" }), {
    action: "list",
  });
});

Deno.test("accepts a bounded transition with reason", () => {
  assertEquals(
    validateAdminTherapyCatalogCommand({
      action: "transition",
      reason: "Conteudo revisado pela curadoria.",
      requestId,
      therapyId,
      transition: "publish",
    }),
    {
      action: "transition",
      payload: {},
      reason: "Conteudo revisado pela curadoria.",
      requestId,
      therapyId,
      transition: "publish",
    },
  );
});

Deno.test("rejects transition without an administrative reason", () => {
  assertThrows(
    () =>
      validateAdminTherapyCatalogCommand({
        action: "transition",
        reason: "",
        requestId,
        therapyId,
        transition: "archive",
      }),
    DomainError,
  );
});

Deno.test(
  "accepts draft save payload without free-text therapy shortcut",
  () => {
    const command = validateAdminTherapyCatalogCommand({
      action: "save",
      payload: {
        categoryId: "33333333-3333-4333-8333-333333333333",
        name: "Nova terapia",
        slug: "nova-terapia",
        shortDescription: "Resumo editorial seguro.",
      },
      requestId,
    });

    assertEquals(command.action, "save");
  },
);

Deno.test("rejects unknown admin catalog actions", () => {
  assertThrows(
    () =>
      validateAdminTherapyCatalogCommand({
        action: "delete_forever" as never,
      }),
    DomainError,
  );
});

Deno.test("accepts therapist catalog request foundation payload", () => {
  const command = validateAdminTherapyCatalogCommand({
    action: "submitRequest",
    payload: {
      informedName: "Terapia solicitada",
      justification: "Ainda nao encontrei essa abordagem no catalogo.",
    },
  });

  assertEquals(command.action, "submitRequest");
});
