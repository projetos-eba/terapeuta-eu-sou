import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TherapyFilters } from "./therapy-filters";

afterEach(cleanup);

describe("TherapyFilters", () => {
  it("keeps quick filters in a horizontal mobile rail and removes manual apply", () => {
    const { container } = render(
      <TherapyFilters
        params={{ page: 1, pageSize: 12, sort: "relevance" }}
        totalCount={3}
      />,
    );

    expect(container.querySelector(".overflow-x-auto")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mais procuradas" })).toHaveClass(
      "shrink-0",
    );
    expect(screen.queryByRole("button", { name: "Aplicar" })).toBeNull();
  });

  it("submits the selected sort automatically", () => {
    const requestSubmit = vi
      .spyOn(HTMLFormElement.prototype, "requestSubmit")
      .mockImplementation(() => undefined);

    render(
      <TherapyFilters
        params={{ page: 1, pageSize: 12, sort: "relevance" }}
        totalCount={3}
      />,
    );

    fireEvent.change(
      screen.getByRole("combobox", { name: "Ordenar terapias" }),
      {
        target: { value: "popular" },
      },
    );

    expect(requestSubmit).toHaveBeenCalledTimes(1);
    requestSubmit.mockRestore();
  });
});
