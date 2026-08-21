import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  renderEmailManagementPreview,
  sanitizeEmailHtml,
} from "./management.ts";

Deno.test("management preview uses only the registry fixture", () => {
  const preview = renderEmailManagementPreview(
    "therapy_catalog_request_submitted",
    {},
  );
  assertEquals(preview.subject.includes("{{"), false);
  assertEquals(preview.html.includes("Pessoa de exemplo"), true);
});

Deno.test(
  "management preview rejects tokens outside the event allowlist",
  () => {
    assertThrows(() =>
      renderEmailManagementPreview("therapy_catalog_request_submitted", {
        html_override: "<p>{{not_allowed}}</p>",
      }),
    );
  },
);

Deno.test("custom HTML removes executable content", () => {
  const sanitized = sanitizeEmailHtml(
    '<p onclick="alert(1)">ok</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>',
  );
  assertEquals(sanitized.includes("script"), false);
  assertEquals(sanitized.includes("onclick"), false);
  assertEquals(sanitized.includes("javascript:"), false);
});

Deno.test("email-safe table and button styling survives sanitization", () => {
  const sanitized = sanitizeEmailHtml(
    '<table role="presentation" width="100%" style="width:100%;border-collapse:collapse"><tr><td align="center" style="padding:16px 12px;border:1px solid #e7daf2"><a href="https://example.test" style="display:inline-block;border-radius:999px;background-color:#6c3d91;text-decoration:none">Acessar</a></td></tr></table>',
  );
  assertEquals(sanitized.includes('role="presentation"'), true);
  assertEquals(sanitized.includes("padding:16px 12px"), true);
  assertEquals(sanitized.includes("border-radius:999px"), true);
  assertEquals(sanitized.includes("javascript:"), false);
});
