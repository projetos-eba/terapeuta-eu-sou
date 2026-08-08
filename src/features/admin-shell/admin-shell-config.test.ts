import { describe, expect, it } from "vitest";

import { adminModuleRegistry, getAdminShellConfig } from "./admin-shell-config";

describe("admin shell config", () => {
  it("links only to implemented admin pages in the current phase", () => {
    const navigation = getAdminShellConfig().navigation;

    expect(navigation.map((item) => item.href)).toEqual([
      "/admin",
      "/admin/profissionais",
      "/admin/profissionais/verificacoes",
      "/admin/pacientes",
      "/admin/sessoes",
      "/admin/suporte",
      "/admin/avaliacoes",
      "/admin/pagamentos",
      "/admin/assinaturas",
      "/admin/terapias",
      "/admin/matching",
      "/admin/integracoes",
      "/admin/seguranca",
      "/admin/relatorios",
    ]);
    expect(navigation.map((item) => item.label)).toEqual([
      "Visão geral",
      "Profissionais",
      "Verificações",
      "Clientes",
      "Sessões",
      "Suporte",
      "Avaliações",
      "Financeiro",
      "Assinaturas",
      "Terapias",
      "Match",
      "Integrações",
      "Segurança",
      "Relatórios",
    ]);
  });

  it("does not expose hidden admin modules in navigation or help link", () => {
    const config = getAdminShellConfig();
    const hiddenHrefs = adminModuleRegistry
      .filter((module) => module.status === "hidden")
      .map((module) => module.href);

    expect(config.helpHref).toBe("/admin/suporte");
    expect(config.navigation.map((item) => item.href)).not.toEqual(
      expect.arrayContaining(hiddenHrefs),
    );
  });

  it("keeps a permission contract for every admin module", () => {
    expect(
      adminModuleRegistry.every(
        (module) =>
          module.permission.startsWith("admin.") &&
          ["enabled", "hidden"].includes(module.status),
      ),
    ).toBe(true);
  });
});
