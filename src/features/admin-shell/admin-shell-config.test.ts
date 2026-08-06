import { describe, expect, it } from "vitest";

import { getAdminShellConfig } from "./admin-shell-config";

describe("admin shell config", () => {
  it("links only to implemented admin pages in the current phase", () => {
    expect(getAdminShellConfig().navigation.map((item) => item.href)).toEqual([
      "/admin",
      "/admin/terapias",
      "/admin/matching",
    ]);
  });
});
