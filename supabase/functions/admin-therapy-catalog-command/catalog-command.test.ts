import { assertEquals, assertThrows } from "jsr:@std/assert";

import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";
import {
  assertAdminCatalogPermission,
  mapAdminTherapyCatalogDatabaseError,
  permissionForAdminTherapyCatalogCommand,
  validateAdminTherapyCatalogCommand,
} from "./catalog-command.ts";

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

Deno.test("accepts private request review reads for admins", () => {
  assertEquals(
    validateAdminTherapyCatalogCommand({ action: "requestList" }),
    { action: "requestList" },
  );
  assertEquals(
    validateAdminTherapyCatalogCommand({
      action: "requestSign",
      materialId: therapyId,
    }),
    { action: "requestSign", materialId: therapyId },
  );
});

Deno.test("maps admin catalog commands to stable permissions", () => {
  assertEquals(
    permissionForAdminTherapyCatalogCommand(
      validateAdminTherapyCatalogCommand({ action: "list" }),
    ),
    "admin.therapies.read",
  );
  assertEquals(
    permissionForAdminTherapyCatalogCommand(
      validateAdminTherapyCatalogCommand({
        action: "matchingSaveTheme",
        payload: { name: "Tema" },
        requestId,
      }),
    ),
    "admin.matching.manage",
  );
  assertEquals(
    permissionForAdminTherapyCatalogCommand(
      validateAdminTherapyCatalogCommand({ action: "requestList" }),
    ),
    "admin.therapies.read",
  );
});

Deno.test("admin catalog permission gate rejects non-admin roles", () => {
  assertAdminCatalogPermission("admin", "admin.therapies.manage");
  assertThrows(
    () =>
      assertAdminCatalogPermission("therapist", "admin.therapies.manage"),
    DomainError,
  );
});

Deno.test("maps blocked Match theme removal to a stable domain error", () => {
  const mapped = mapAdminTherapyCatalogDatabaseError(
    new SupabaseHttpError(
      400,
      'ADMIN_THERAPY_CATALOG_MATCHING_THEME_REMOVAL_BLOCKED:{"affectedServiceCount":1}',
    ),
  );

  if (!(mapped instanceof DomainError)) {
    throw new Error("Expected DomainError.");
  }

  assertEquals(mapped.code, "matching_theme_removal_blocked");
  assertEquals(mapped.status, 409);
});

Deno.test("maps therapy content limits to clear product messages", () => {
  const mapped = mapAdminTherapyCatalogDatabaseError(
    new SupabaseHttpError(
      400,
      "ADMIN_THERAPY_CATALOG_SHORT_DESCRIPTION_TOO_LONG",
    ),
  );

  if (!(mapped instanceof DomainError)) {
    throw new Error("Expected DomainError.");
  }

  assertEquals(mapped.code, "short_description_too_long");
  assertEquals(mapped.message, "O resumo deve ter no máximo 100 caracteres.");
});
