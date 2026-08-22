import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShellUserMenu } from "./shell-user-menu";

describe("ShellUserMenu", () => {
  afterEach(cleanup);

  it.each(["Free", "Premium", "Premium Plus"])(
    "links the effective TES %s badge to the plan center",
    (planLabel) => {
      render(
        <ShellUserMenu
          accountHref="/terapeuta/configuracoes"
          logoutHref="/terapeuta/login"
          planLabel={planLabel}
          user={{
            email: "ana@example.test",
            name: "Ana",
            roleLabel: "Terapeuta",
          }}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Abrir menu da conta de Ana" }),
      );

      expect(
        screen.getByRole("link", {
          name: `Abrir planos. Plano atual: TES ${planLabel}`,
        }),
      ).toHaveAttribute("href", "/terapeuta/plano");
    },
  );

  it("opens the account details and keeps the primary account actions accessible", () => {
    const logoutAction = vi.fn();

    render(
      <ShellUserMenu
        accountHref="/app/configuracoes"
        logoutAction={logoutAction}
        logoutHref="/cliente/login"
        user={{
          email: "ana@example.test",
          name: "Ana",
          roleLabel: "Paciente",
        }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir menu da conta de Ana" }),
    );

    expect(screen.getByText("ana@example.test")).toBeVisible();
    expect(screen.getByRole("link", { name: "Minha conta" })).toHaveAttribute(
      "href",
      "/app/configuracoes",
    );
    expect(screen.getByRole("button", { name: "Sair" })).toBeVisible();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("link", { name: "Minha conta" })).toBeNull();
  });
});
