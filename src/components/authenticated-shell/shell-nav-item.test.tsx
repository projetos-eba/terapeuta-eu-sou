import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/terapeuta/insights",
}));

import { ShellNavItem } from "./shell-nav-item";

describe("ShellNavItem", () => {
  it("renders a coming-soon item without a link or navigation affordance", () => {
    render(
      <ShellNavItem
        item={{
          accessState: "coming_soon",
          availabilityLabel: "Em breve",
          href: "/terapeuta/assessor-ia",
          icon: "lightbulb",
          label: "Assessora Aura",
        }}
      />,
    );

    expect(screen.getByLabelText("Assessora Aura: Em breve")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText("Em breve")).toBeVisible();
    expect(screen.queryByRole("link", { name: /Assessora Aura/ })).toBeNull();
  });
});
