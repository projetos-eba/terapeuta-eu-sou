import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/plus",
}));

import { AuthenticatedShell } from "./authenticated-shell";

describe("AuthenticatedShell mobile", () => {
  it("opens and closes the responsive drawer by keyboard-accessible controls", () => {
    render(
      <AuthenticatedShell
        helpHref="/plus/suporte"
        navigation={[{ href: "/plus", icon: "home", label: "Início" }]}
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
});
