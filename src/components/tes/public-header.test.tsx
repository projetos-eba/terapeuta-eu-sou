import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PublicHeader } from "./public-header";

describe("PublicHeader", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("opens the mobile menu from an icon and exposes profile-specific login links", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ authenticated: false }),
        ok: true,
      }),
    );

    render(<PublicHeader />);

    const toggle = screen.getByRole("button", { name: "Abrir menu" });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Navegação")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const mobileMenu = screen.getByText("Navegação").closest("div");
    expect(mobileMenu).not.toBeNull();
    const mobileMenuQueries = within(mobileMenu!.parentElement!);

    expect(
      mobileMenuQueries.getByRole("link", { name: /entrar como cliente/i }),
    ).toHaveAttribute("href", "/cliente/login");
    expect(
      mobileMenuQueries.getByRole("link", { name: /entrar como terapeuta/i }),
    ).toHaveAttribute("href", "/terapeuta/login");
  });

  it("keeps the desktop header CTA available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ authenticated: false }),
        ok: true,
      }),
    );

    render(<PublicHeader />);

    expect(
      screen.getByRole("link", { name: /^começar minha jornada$/i }),
    ).toHaveAttribute("href", "/sua-jornada");
  });
});
