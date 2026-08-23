import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PublicFooter } from "./public-footer";

describe("PublicFooter", () => {
  afterEach(() => cleanup());

  it("uses the current institutional copy and removes obsolete public links", () => {
    render(<PublicFooter />);

    expect(
      screen.getByText(
        "Onde terapeutas encontram espaço e pessoas encontram caminhos.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "O que é o TES?" }),
    ).toHaveAttribute("href", "/sobre-nos");

    expect(screen.queryByRole("link", { name: "Recursos" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Central de ajuda/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Ajuda com Zoom/i })).toBeNull();
    expect(screen.queryByRole("link", { name: "Políticas" })).toBeNull();
    expect(screen.queryByRole("link", { name: "LGPD" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Legal" })).toBeNull();
  });

  it("keeps privacy and terms as legal links", () => {
    render(<PublicFooter />);

    expect(
      screen.getByRole("link", { name: "Política de privacidade" }),
    ).toHaveAttribute("href", "/privacidade");
    expect(screen.getByRole("link", { name: "Termos de uso" })).toHaveAttribute(
      "href",
      "/termos",
    );
  });
});
