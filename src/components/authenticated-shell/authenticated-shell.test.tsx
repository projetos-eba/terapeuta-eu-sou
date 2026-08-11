import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigationState = vi.hoisted(() => ({ pathname: "/terapeuta" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
}));

import { AuthenticatedShell } from "./authenticated-shell";

describe("AuthenticatedShell mobile", () => {
  afterEach(() => {
    cleanup();
    navigationState.pathname = "/terapeuta";
  });

  it("opens and closes the responsive drawer by keyboard-accessible controls", () => {
    render(
      <AuthenticatedShell
        helpHref="/terapeuta/suporte"
        navigation={[{ href: "/terapeuta", icon: "home", label: "Início" }]}
        user={{ name: "Ana", roleLabel: "Terapeuta" }}
        variant="therapist"
      >
        <p>Conteúdo</p>
      </AuthenticatedShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    expect(screen.getByLabelText("Navegação principal")).toHaveClass(
      "translate-x-0",
    );
    fireEvent.click(screen.getByRole("button", { name: "Fechar menu" }));
    expect(screen.getByLabelText("Navegação principal")).toHaveClass(
      "-translate-x-full",
    );
  });

  it("removes navigation chrome from dedicated video rooms", () => {
    navigationState.pathname = "/terapeuta/sessoes/booking-id/video";

    render(
      <AuthenticatedShell
        helpHref="/terapeuta/suporte"
        navigation={[{ href: "/terapeuta", icon: "home", label: "Início" }]}
        user={{ name: "Ana", roleLabel: "Terapeuta" }}
        variant="therapist"
      >
        <p>Sala dedicada</p>
      </AuthenticatedShell>,
    );

    expect(screen.getByText("Sala dedicada")).toBeVisible();
    expect(screen.queryByLabelText("Navegação principal")).toBeNull();
    expect(screen.queryByRole("button", { name: "Abrir menu" })).toBeNull();
  });
});
