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

function assert(value: unknown) {
  if (!value) {
    throw new Error("Assertion failed.");
  }
}
