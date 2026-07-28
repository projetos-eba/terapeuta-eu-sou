import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("patient encounter copy", () => {
  it("keeps primary patient actions in the Encontro language", () => {
    const mapper = readFileSync(
      join(
        root,
        "src/features/patient-encounters/patient-encounters.mappers.ts",
      ),
      "utf8",
    );

    expect(mapper).toContain("Entrar no encontro");
    expect(mapper).toContain("Avaliar encontro");
    expect(mapper).not.toContain("Abrir sessão");
    expect(mapper).not.toContain("Avaliar sessão");
  });
});
