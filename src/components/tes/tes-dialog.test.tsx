import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
});
