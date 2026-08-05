import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PlansPreviewSection } from "./plan-comparison";
import { planCategoryLabels } from "./content";

describe("PlansPreviewSection", () => {
  afterEach(() => cleanup());

  it("renders plan category separators as semantic grouped table headers", () => {
    render(<PlansPreviewSection />);

    const table = screen.getByRole("table", {
      name: "Comparativo de recursos dos planos para terapeutas",
    });

    Object.values(planCategoryLabels).forEach((label) => {
      const header = within(table)
        .getAllByRole("columnheader", { name: label })
        .find((element) => element.getAttribute("colspan") === "4");

      expect(header).toBeDefined();
      expect(header).toHaveAttribute("colspan", "4");
      expect(header).toHaveClass("bg-brand-lavenderSoft");
      expect(header).toHaveClass("text-brand-deep");
    });
  });
});
