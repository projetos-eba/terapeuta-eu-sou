import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TESDialog } from "./tes-dialog";

describe("TESDialog", () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("uses a visible overlay, locks scroll and closes with Escape", async () => {
    const onClose = vi.fn();
    render(
      <TESDialog
        description="Descrição segura"
        onClose={onClose}
        title="Título do modal"
      >
        <button type="button">Confirmar</button>
      </TESDialog>,
    );

    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(screen.getByTestId("tes-dialog-overlay")).toHaveClass(
      "bg-[var(--tes-color-overlay)]",
    );
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes only when the backdrop itself is pressed", async () => {
    const onClose = vi.fn();
    render(
      <TESDialog onClose={onClose} title="Modal">
        <button type="button">Ação interna</button>
      </TESDialog>,
    );

    const dialog = await screen.findByRole("dialog");
    fireEvent.mouseDown(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByTestId("tes-dialog-overlay"));
    expect(onClose).toHaveBeenCalledOnce();

    expect(document.body.style.overflow).toBe("hidden");
  });

  it("keeps focus inside the active input when the parent rerenders", async () => {
    function RerenderingDialog() {
      const [value, setValue] = useState("");

      return (
        <TESDialog onClose={() => undefined} title="Novo tema">
          <label>
            Nome
            <input
              aria-label="Nome"
              onChange={(event) => setValue(event.target.value)}
              value={value}
            />
          </label>
          <button type="button">Salvar</button>
        </TESDialog>
      );
    }

    render(<RerenderingDialog />);

    const input = await screen.findByLabelText("Nome");
    input.focus();
    fireEvent.change(input, { target: { value: "Emoções" } });

    expect(input).toHaveFocus();
    expect(input).toHaveValue("Emoções");
  });
});
