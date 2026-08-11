import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ShellUserMenu } from "./shell-user-menu";

describe("ShellUserMenu", () => {
  afterEach(cleanup);

  it.each(["Free", "Premium", "Premium Plus"])(
    "links the effective TES %s badge to the plan center",
    (planLabel) => {
      render(
        <ShellUserMenu
          planLabel={planLabel}
          user={{ name: "Ana", roleLabel: "Terapeuta" }}
        />,
      );

      expect(
        screen.getByRole("link", {
          name: `Abrir planos. Plano atual: TES ${planLabel}`,
        }),
      ).toHaveAttribute("href", "/terapeuta/plano");
    },
  );
});
