import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PendingNavigationLink } from "./pending-navigation-link";

const linkState = vi.hoisted(() => ({ pending: false }));
let currentPathname = "/";
let currentSearchParams = new URLSearchParams();

type MockLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children?: ReactNode;
  onNavigate?: (event: { preventDefault: () => void }) => void;
  scroll?: boolean;
};

vi.mock("next/link", async () => {
  const React = await import("react");

  return {
    default: ({
      children,
      onNavigate,
      scroll: _scroll,
      ...props
    }: MockLinkProps) =>
      React.createElement(
        "a",
        {
          ...props,
          onClick: (event: MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            onNavigate?.({ preventDefault: () => undefined });
          },
        },
        children,
      ),
    useLinkStatus: () => linkState,
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => currentSearchParams,
}));

afterEach(() => {
  cleanup();
  linkState.pending = false;
  vi.restoreAllMocks();
  document.documentElement.style.minHeight = "";
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  currentPathname = "/";
  currentSearchParams = new URLSearchParams();
});

describe("PendingNavigationLink", () => {
  it("uses the native Link transition status and returns to the default label", () => {
    const { rerender } = render(
      <PendingNavigationLink href="/lista?page=2">
        Carregar mais
      </PendingNavigationLink>,
    );

    expect(screen.getByText("Carregar mais")).toHaveAttribute(
      "aria-busy",
      "false",
    );

    linkState.pending = true;
    rerender(
      <PendingNavigationLink href="/lista?page=2">
        Carregar mais
      </PendingNavigationLink>,
    );

    expect(screen.getByText("Carregando…")).toHaveAttribute(
      "aria-busy",
      "true",
    );

    linkState.pending = false;
    rerender(
      <PendingNavigationLink href="/lista?page=3">
        Carregar mais
      </PendingNavigationLink>,
    );

    expect(screen.getByText("Carregar mais")).toHaveAttribute(
      "aria-busy",
      "false",
    );
  });

  it("restores the saved scroll position after the destination is rendered", () => {
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
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 1840,
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
    expect(document.documentElement.style.minHeight).toBe("4200px");

    window.history.replaceState(null, "", "/lista?page=2");
    currentSearchParams = new URLSearchParams("page=2");
    rerender(
      <PendingNavigationLink href="/lista?page=3">
        Carregar mais
      </PendingNavigationLink>,
    );

    expect(scrollTo).toHaveBeenCalledWith({ behavior: "auto", top: 1840 });
    expect(document.documentElement.style.minHeight).toBe("");
  });
});
