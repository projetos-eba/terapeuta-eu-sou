import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PendingNavigationLink } from "./pending-navigation-link";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

afterEach(() => {
  push.mockReset();
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("PendingNavigationLink", () => {
  it("finishes the loading state after the destination is rendered", () => {
    window.history.replaceState(null, "", "/lista?page=1");
    const { rerender } = render(
      <PendingNavigationLink href="/lista?page=2">
        Carregar mais
      </PendingNavigationLink>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Carregar mais" }));
    expect(screen.getByRole("link", { name: "Carregando…" })).toHaveAttribute(
      "aria-busy",
      "true",
    );

    window.history.replaceState(null, "", "/lista?page=2");
    rerender(
      <PendingNavigationLink href="/lista?page=3">
        Carregar mais
      </PendingNavigationLink>,
    );

    expect(screen.getByRole("link", { name: "Carregar mais" })).toHaveAttribute(
      "aria-busy",
      "false",
    );
  });
});
