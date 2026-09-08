import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicTherapistsLowerBanner } from "./public-therapists-lower-banner";

describe("PublicTherapistsLowerBanner", () => {
  it("apresenta a chamada de descoberta e leva ao catálogo público", () => {
    render(<PublicTherapistsLowerBanner />);

    expect(
      screen.getByRole("heading", {
        name: "Encontre um caminho que faça sentido para você",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Explore perfis, conheça abordagens e escolha com calma quem pode acompanhar o seu momento.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Explorar caminhos" }),
    ).toHaveAttribute("href", "/terapeutas");
  });
});
