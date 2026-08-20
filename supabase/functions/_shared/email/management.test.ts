import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { renderEmailManagementPreview, sanitizeEmailHtml } from "./management.ts";

Deno.test("management preview uses only the registry fixture", () => {
  const preview = renderEmailManagementPreview("therapy_catalog_request_submitted", {});
  assertEquals(preview.subject.includes("{{"), false);
  assertEquals(preview.html.includes("Pessoa de exemplo"), true);
});

Deno.test("management preview rejects tokens outside the event allowlist", () => {
  assertThrows(() => renderEmailManagementPreview("therapy_catalog_request_submitted", { html_override: "<p>{{not_allowed}}</p>" }));
});

Deno.test("custom HTML removes executable content", () => {
  const sanitized = sanitizeEmailHtml('<p onclick="alert(1)">ok</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>');
  assertEquals(sanitized.includes("script"), false);
  assertEquals(sanitized.includes("onclick"), false);
  assertEquals(sanitized.includes("javascript:"), false);
});
