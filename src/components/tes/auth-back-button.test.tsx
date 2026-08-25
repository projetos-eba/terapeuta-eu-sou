import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthBackButton } from "./auth-back-button";

describe("AuthBackButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the public home instead of the previous page when requested", () => {
    const replace = vi.fn();
    const originalLocation = window.location;

    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, replace },
    });

    render(<AuthBackButton alwaysFallback fallbackHref="/" />);
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(replace).toHaveBeenCalledWith("/");

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });
});
