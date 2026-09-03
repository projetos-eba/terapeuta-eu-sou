import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TherapistAttentionSection } from "./therapist-attention-section";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("TherapistAttentionSection", () => {
  it.each([0, 1, 3])(
    "does not show the all-items action for %s items",
    (count) => {
      render(<TherapistAttentionSection items={items(count)} />);

      expect(screen.queryByRole("button", { name: /Ver todos/ })).toBeNull();
      expect(screen.queryAllByRole("link")).toHaveLength(count);
    },
  );

  it("opens all items in a dialog when there are more than three", async () => {
    render(<TherapistAttentionSection items={items(4)} />);

    expect(screen.getAllByRole("link")).toHaveLength(3);
    const allItemsButton = screen.getByRole("button", { name: /Ver todos/ });
    allItemsButton.focus();
    fireEvent.click(allItemsButton);

    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus();
    expect(screen.getAllByRole("link")).toHaveLength(7);
    expect(screen.getByRole("link", { name: "Item 4" })).toHaveAttribute(
      "href",
      "/terapeuta/perfil",
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(allItemsButton).toHaveFocus());
  });
});

function items(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    href: "/terapeuta/perfil",
    id: `item-${index + 1}`,
    label: `Item ${index + 1}`,
    tone: index === 0 ? ("warning" as const) : ("info" as const),
  }));
}
