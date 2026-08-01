import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const patientSurfaceFiles = [
  "src/features/patient-overview/patient-overview.queries.ts",
  "src/features/patient-encounters/patient-encounters.queries.ts",
  "src/features/booking-detail/booking-detail.queries.ts",
  "src/features/booking-detail/booking-detail.mappers.ts",
  "src/features/patient-encounters/patient-encounters.mappers.ts",
];

describe("patient meeting URL privacy", () => {
  it("does not select or map raw meeting_url in patient surfaces", () => {
    for (const file of patientSurfaceFiles) {
      const source = readFileSync(join(process.cwd(), file), "utf8");

      expect(source, file).not.toContain("meeting_url");
    }
  });
});
