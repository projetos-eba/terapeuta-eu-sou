import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TherapyFilters } from "./therapy-filters";

afterEach(cleanup);

describe("TherapyFilters", () => {
  it("keeps quick filters in a horizontal mobile rail and removes manual apply", () => {
    const { container } = render(
      <TherapyFilters
        params={{ page: 1, pageSize: 12, sort: "most_searched" }}
        totalCount={3}
      />,
    );

    expect(container.querySelector(".overflow-x-auto")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mais procuradas" })).toHaveClass(
      "shrink-0",
    );
    expect(
      screen.getByRole("link", { name: "Adicionadas recentemente" }),
    ).toHaveAttribute("href", "/terapias?sort=newest");
    expect(screen.getByRole("link", { name: "A–Z" })).toHaveAttribute(
      "href",
      "/terapias?sort=az",
    );
    expect(screen.queryByRole("link", { name: "Mais populares" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Aplicar" })).toBeNull();
  });

  it("submits the selected sort automatically", () => {
    const requestSubmit = vi
      .spyOn(HTMLFormElement.prototype, "requestSubmit")
      .mockImplementation(() => undefined);

    render(
      <TherapyFilters
        params={{ page: 1, pageSize: 12, sort: "most_searched" }}
        totalCount={3}
      />,
    );

    fireEvent.change(
      screen.getByRole("combobox", { name: "Ordenar terapias" }),
      {
        target: { value: "newest" },
      },
    );

    expect(requestSubmit).toHaveBeenCalledTimes(1);
    requestSubmit.mockRestore();
  });
});
