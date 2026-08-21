import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AdminSettingsPageData } from "../admin-settings.types";
import { AdminSettingsPage } from "./admin-settings-page";

const data: AdminSettingsPageData = {
  generatedAt: "2026-08-11T12:00:00.000Z",
  groups: [
    {
      description: "Políticas da experiência.",
      items: [
        {
          description: "Atendimento disponível somente online.",
          key: "online-only",
          label: "Atendimento online",
          source: "internal_file_name",
          status: "healthy",
          tone: "success",
        },
      ],
      key: "product",
      title: "Produto",
    },
  ],
  releaseChecks: [
    {
      description: "Áreas administrativas disponíveis.",
      key: "navigation",
      label: "Navegação",
      status: "healthy",
    },
  ],
  secretPolicy: ["Credenciais privadas não são exibidas nesta área."],
};

describe("AdminSettingsPage", () => {
  it("renders the supervised settings view without internal sources", () => {
    const html = renderToStaticMarkup(<AdminSettingsPage data={data} />);

    expect(html).toContain("Configurações");
    expect(html).toContain("Visão supervisionada");
    expect(html).toContain("Atendimento online");
    expect(html).not.toContain("internal_file_name");
    expect(html).not.toContain("Fonte:");
  });

  it("renders an explicit entry when a governed area has a route", () => {
    const html = renderToStaticMarkup(
      <AdminSettingsPage
        data={{
          ...data,
          groups: [
            {
              ...data.groups[0],
              items: [
                {
                  ...data.groups[0].items[0],
                  actionLabel: "Gerenciar e-mails",
                  href: "/admin/configuracoes/emails",
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(html).toContain("Gerenciar e-mails");
    expect(html).toContain("/admin/configuracoes/emails");
  });
});
