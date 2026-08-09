import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("public matching journey page prerender boundary", () => {
  it("waits for an incoming request before fetching live Match config", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/sua-jornada/page.tsx"),
      "utf8",
    );

    const connectionIndex = source.indexOf("await connection()");
    const fetchIndex = source.indexOf("getPublicMatchingConfig()");

    expect(connectionIndex).toBeGreaterThanOrEqual(0);
    expect(fetchIndex).toBeGreaterThan(connectionIndex);
  });
});
