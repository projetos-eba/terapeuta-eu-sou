import { describe, expect, it } from "vitest";

import { isAdminPermission } from "@/lib/auth/admin-permissions";

import { adminModuleRegistry, getAdminShellConfig } from "./admin-shell-config";

describe("admin shell config", () => {
  it("links only to implemented admin pages in the current phase", () => {
    const navigation = getAdminShellConfig().navigation;

    expect(navigation.map((item) => item.href)).toEqual([
      "/admin",
      "/admin/profissionais",
      "/admin/pacientes",
      "/admin/sessoes",
      "/admin/suporte",
      "/admin/avaliacoes",
      "/admin/pagamentos",
      "/admin/assinaturas",
      "/admin/terapias",
      "/admin/matching",
      "/admin/seguranca",
      "/admin/configuracoes",
    ]);
    expect(navigation.map((item) => item.label)).toEqual([
      "Visão geral",
      "Profissionais",
      "Clientes",
      "Sessões",
      "Suporte",
      "Avaliações",
      "Financeiro",
      "Assinaturas",
      "Terapias",
      "Match",
      "Segurança",
      "Configurações",
    ]);
    expect(navigation.flatMap((item) => item.children ?? [])).toEqual([
      {
        href: "/admin/profissionais/verificacoes",
        icon: "user-pen",
        label: "Verificações",
      },
    ]);
  });

  it("does not expose hidden admin modules in navigation or help link", () => {
    const config = getAdminShellConfig();
    const hiddenHrefs = adminModuleRegistry
      .filter((module) => module.status === "hidden")
      .map((module) => module.href);

    expect(config.helpHref).toBeUndefined();
    if (hiddenHrefs.length > 0) {
      expect(
        config.navigation.flatMap((item) => [
          item.href,
          ...(item.children?.map((child) => child.href) ?? []),
        ]),
      ).not.toEqual(
        expect.arrayContaining(hiddenHrefs),
      );
    } else {
      expect(hiddenHrefs).toEqual([]);
    }
  });

  it("keeps a permission contract for every admin module", () => {
    expect(
      adminModuleRegistry.every(
        (module) =>
          isAdminPermission(module.permission) &&
          ["enabled", "hidden"].includes(module.status),
      ),
    ).toBe(true);
  });

  it("keeps read-only settings out of manage capability until mutations exist", () => {
    expect(
      adminModuleRegistry.find((module) => module.key === "settings")
        ?.permission,
    ).toBe("admin.settings.read");
  });
});
