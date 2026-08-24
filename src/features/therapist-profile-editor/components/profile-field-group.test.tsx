import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { ProfileChipInput } from "./profile-field-group";

function Harness({ initial = [] }: { initial?: string[] }) {
  const [items, setItems] = useState(initial);
  return (
    <ProfileChipInput
      items={items}
      label="Caminhos"
      max={3}
      onChange={setItems}
      placeholder="Novo Caminho"
    />
  );
}

describe("ProfileChipInput", () => {
  it("keeps a new input while the user clears it", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar item" }));
    const input = screen.getByPlaceholderText("Novo Caminho");

    fireEvent.change(input, { target: { value: "Caminho" } });
    fireEvent.change(input, { target: { value: "" } });

    expect(screen.getByPlaceholderText("Novo Caminho")).toBeInTheDocument();
  });

  it("removes an item only after the explicit remove action", () => {
    render(<Harness initial={["Escuta"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Remover Escuta" }));

    expect(screen.queryByDisplayValue("Escuta")).not.toBeInTheDocument();
  });
});
