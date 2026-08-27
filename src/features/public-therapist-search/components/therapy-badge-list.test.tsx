import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TherapyBadgeList } from "./therapy-badge-list";

afterEach(cleanup);

describe("TherapyBadgeList", () => {
  it("shows at most two therapies and exposes the remaining names on hover", () => {
    render(
      <TherapyBadgeList
        therapistName="Brunna P"
        therapies={[
          { id: "taro", label: "Tarô", slug: "taro" },
          { id: "reiki", label: "Reiki", slug: "reiki" },
          {
            id: "constelacao",
            label: "Constelação Familiar",
            slug: "constelacao-familiar",
          },
          { id: "aromaterapia", label: "Aromaterapia", slug: "aromaterapia" },
        ]}
      />,
    );

    expect(screen.getByText("Tarô")).toBeInTheDocument();
    expect(screen.getByText("Reiki")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /ver mais 2 terapias/i }),
    ).toHaveTextContent("+2");
    expect(screen.getByRole("button", { name: /ver mais 2 terapias/i })).toHaveClass(
      "min-h-11",
      "min-w-11",
    );
    expect(screen.getByRole("tooltip")).toHaveClass("hidden");

    fireEvent.mouseEnter(
      screen.getByRole("button", { name: /ver mais 2 terapias/i }),
    );

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Constelação Familiar",
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent("Aromaterapia");
  });

  it("opens the remaining therapies with keyboard focus and closes with Escape", () => {
    render(
      <TherapyBadgeList
        therapistName="Brunna P"
        therapies={[
          { id: "taro", label: "Tarô", slug: "taro" },
          { id: "reiki", label: "Reiki", slug: "reiki" },
          {
            id: "constelacao",
            label: "Constelação Familiar",
            slug: "constelacao-familiar",
          },
        ]}
      />,
    );

    const button = screen.getByRole("button", { name: /ver mais 1 terapia/i });
    fireEvent.focus(button);
    expect(screen.getByRole("tooltip")).toBeVisible();
    expect(button).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(button, { key: "Escape" });

    expect(screen.getByRole("tooltip")).toHaveClass("hidden");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});
