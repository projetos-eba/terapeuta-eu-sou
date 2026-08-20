import { renderEmailTemplate } from "./templates.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

Deno.test("email verification template escapes dynamic values", () => {
  const rendered = renderEmailTemplate("email_verification", {
    name: "<Ana>",
    role: "patient",
    url: "https://example.test/confirmar-email?token=abc",
  });

  assert(rendered.subject.includes("Confirme"));
  assert(rendered.html.includes("&lt;Ana&gt;"));
  assert(!rendered.html.includes("<Ana>"));
  assert(rendered.text.includes("https://example.test/confirmar-email"));
});

Deno.test("password reset template rejects unsafe URLs", () => {
  try {
    renderEmailTemplate("password_reset", {
      url: "javascript:alert(1)",
    });
    throw new Error("Expected template failure.");
  } catch (error) {
    assert(error instanceof Error);
    if (error instanceof Error) {
      assert(error.message === "invalid_template_url");
    }
  }
});

Deno.test("catalog overrides use only the event allowlist and escape values", () => {
  const rendered = renderEmailTemplate(
    "therapy_catalog_request_submitted",
    { name: "<Pessoa>", requestName: "Pedido", url: "https://example.test/request" },
    { subject_override: "Atualização {{request_name}}", html_override: "<p>{{recipient_name}}</p><script>alert(1)</script>" },
  );
  assert(rendered.subject === "Atualização Pedido");
  assert(rendered.html.includes("&lt;Pessoa&gt;"));
  assert(!rendered.html.includes("script"));
});

Deno.test("catalog overrides fail closed for unknown tokens", () => {
  try {
    renderEmailTemplate("therapy_catalog_request_submitted", { url: "https://example.test" }, { text_override: "{{unknown}}" });
    throw new Error("Expected template failure.");
  } catch (error) {
    assert(error instanceof Error && error.message === "email_template_token_not_allowed");
  }
});

function assert(value: unknown) {
  if (!value) {
    throw new Error("Assertion failed.");
  }
}
