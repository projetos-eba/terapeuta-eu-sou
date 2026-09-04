import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PendingNavigationLink } from "./pending-navigation-link";

const push = vi.fn();
let currentPathname = "/";
let currentSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ push }),
  useSearchParams: () => currentSearchParams,
}));

afterEach(() => {
  push.mockReset();
  vi.restoreAllMocks();
  document.documentElement.style.minHeight = "";
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  currentPathname = "/";
  currentSearchParams = new URLSearchParams();
});

describe("PendingNavigationLink", () => {
  it("finishes the loading state after the destination is rendered", () => {
    const scrollTo = vi
      .spyOn(window, "scrollTo")
      .mockImplementation(() => undefined);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 4200,
    });
    window.history.replaceState(null, "", "/lista?page=1");
    currentPathname = "/lista";
    currentSearchParams = new URLSearchParams("page=1");
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
    expect(document.documentElement.style.minHeight).toBe("4200px");

    window.history.replaceState(null, "", "/lista?page=2");
    currentSearchParams = new URLSearchParams("page=2");
    rerender(
      <PendingNavigationLink href="/lista?page=2">
        Carregar mais
      </PendingNavigationLink>,
    );

    expect(screen.getByRole("link", { name: "Carregar mais" })).toHaveAttribute(
      "aria-busy",
      "false",
    );
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "auto", top: 0 });
    expect(document.documentElement.style.minHeight).toBe("");
  });
});
