import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AutoSubmitSelect } from "./auto-submit-select";

describe("AutoSubmitSelect", () => {
  it("submits its form when the selected filter changes", () => {
    render(
      <form action="/terapeutas">
        <label htmlFor="therapy">Tipo de terapia</label>
        <AutoSubmitSelect defaultValue="" id="therapy" name="therapy">
          <option value="">Tipo de terapia</option>
          <option value="reiki">Reiki</option>
        </AutoSubmitSelect>
      </form>,
    );
    const select = screen.getByLabelText<HTMLSelectElement>(
      "Tipo de terapia",
    );
    const requestSubmit = vi.fn();
    const form = select.form;
    if (!form) throw new Error("Search filter must belong to a form");

    Object.defineProperty(form, "requestSubmit", {
      configurable: true,
      value: requestSubmit,
    });

    fireEvent.change(select, { target: { value: "reiki" } });

    expect(requestSubmit).toHaveBeenCalledOnce();
  });
});
