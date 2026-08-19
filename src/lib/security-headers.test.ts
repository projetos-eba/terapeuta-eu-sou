import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("global security headers", () => {
  it("keeps the baseline headers at the Next.js boundary", () => {
    const nextConfigSource = readFileSync(
      join(process.cwd(), "next.config.mjs"),
      "utf8",
    );

    expect(nextConfigSource).toContain('source: "/:path*"');
    expect(nextConfigSource).toContain("poweredByHeader: false");
    expect(nextConfigSource).toContain('key: "Content-Security-Policy"');
    expect(nextConfigSource).toContain("frame-ancestors 'none'");
    expect(nextConfigSource).toContain('key: "X-Frame-Options"');
    expect(nextConfigSource).toContain('key: "X-Content-Type-Options"');
    expect(nextConfigSource).toContain('key: "Referrer-Policy"');
    expect(nextConfigSource).toContain('key: "Permissions-Policy"');
    expect(nextConfigSource).toContain('key: "Strict-Transport-Security"');
  });
});
