import { describe, expect, it } from "vitest";

import {
  adminPermissions,
  canUseAdminPermission,
  getAdminPermissionsForRole,
  isAdminPermission,
} from "./admin-permissions";

describe("admin permissions", () => {
  it("keeps a stable canonical permission catalog", () => {
    expect(adminPermissions).toContain("admin.dashboard.read");
    expect(adminPermissions).toContain("admin.professionals.verify");
    expect(adminPermissions).toContain("admin.payments.refund");
    expect(adminPermissions).toContain("admin.audit.read");
    expect(adminPermissions).toContain("admin.settings.manage");
  });

  it("grants the current admin role the full explicit catalog", () => {
    const permissions = getAdminPermissionsForRole("admin");

    expect(permissions).toEqual([...adminPermissions]);
    expect(canUseAdminPermission(permissions, "admin.matching.manage")).toBe(
      true,
    );
  });

  it("validates permission strings before they become contracts", () => {
    expect(isAdminPermission("admin.sessions.manage")).toBe(true);
    expect(isAdminPermission("admin.sessions.delete_forever")).toBe(false);
  });
});
