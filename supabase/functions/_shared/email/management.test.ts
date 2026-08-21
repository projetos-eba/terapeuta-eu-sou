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

Deno.test("the TES logo keeps only its safe HTTPS image attributes", () => {
  const sanitized = sanitizeEmailHtml(
    '<img src="https://terapeutaeusou.com.br/logo-oficial-terapeuta-eu-sou.png" alt="Terapeuta Eu Sou" width="156" onerror="alert(1)" style="display:block;height:auto;max-width:156px;width:100%"><img src="data:image/png;base64,abc" alt="blocked">',
  );
  assertEquals(
    sanitized.includes('src="https://terapeutaeusou.com.br/logo-oficial-terapeuta-eu-sou.png"'),
    true,
  );
  assertEquals(sanitized.includes('alt="Terapeuta Eu Sou"'), true);
  assertEquals(sanitized.includes("onerror"), false);
  assertEquals(sanitized.includes("data:image"), false);
});
