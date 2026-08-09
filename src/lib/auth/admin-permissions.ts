export const adminPermissions = [
  "admin.dashboard.read",
  "admin.professionals.read",
  "admin.professionals.verify",
  "admin.professionals.suspend",
  "admin.patients.read",
  "admin.sessions.read",
  "admin.sessions.manage",
  "admin.payments.read",
  "admin.payments.refund",
  "admin.payments.reconcile",
  "admin.payouts.read",
  "admin.payouts.manage",
  "admin.subscriptions.read",
  "admin.subscriptions.manage",
  "admin.reviews.read",
  "admin.reviews.moderate",
  "admin.support.read",
  "admin.support.manage",
  "admin.therapies.read",
  "admin.therapies.manage",
  "admin.matching.read",
  "admin.matching.manage",
  "admin.integrations.read",
  "admin.integrations.manage",
  "admin.security.read",
  "admin.audit.read",
  "admin.reports.read",
  "admin.reports.export",
  "admin.settings.read",
  "admin.settings.manage",
] as const;

export type AdminPermission = (typeof adminPermissions)[number];
export type AdminRole = "admin";

const allAdminPermissions = new Set<AdminPermission>(adminPermissions);

export function isAdminPermission(value: string): value is AdminPermission {
  return allAdminPermissions.has(value as AdminPermission);
}

export function getAdminPermissionsForRole(role: AdminRole): AdminPermission[] {
  if (role === "admin") return [...adminPermissions];
  return [];
}

export function canUseAdminPermission(
  permissions: readonly AdminPermission[],
  permission: AdminPermission,
) {
  return permissions.includes(permission);
}
