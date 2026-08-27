import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}));

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
      mobileMenuQueries.getByRole("link", { name: /o que é o tes\?/i }),
    ).toHaveAttribute("href", "/sobre-nos");
    expect(
      await mobileMenuQueries.findByRole("link", {
        name: /entrar como cliente/i,
      }),
    ).toHaveAttribute("href", "/cliente/login");
    expect(
      await mobileMenuQueries.findByRole("link", {
        name: /entrar como terapeuta/i,
      }),
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
      screen.getAllByRole("link", { name: /^o que é o tes\?$/i })[0],
    ).toHaveAttribute("href", "/sobre-nos");
    expect(
      screen.getByRole("link", { name: /^começar minha jornada$/i }),
    ).toHaveAttribute("href", "/sua-jornada");
  });

  it("shows the profile search shortcut when requested", () => {
    render(<PublicHeader showMobileSearch />);

    expect(
      screen.getByRole("link", { name: "Buscar terapeutas" }),
    ).toHaveAttribute("href", "/terapeutas");
  });

  it("does not look up the viewer while rendering a static preview", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicHeader staticPreview />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: /^começar minha jornada$/i }),
    ).toBeInTheDocument();
  });

  it("uses the sidebar breakpoint for all non-large header controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ authenticated: false }),
        ok: true,
      }),
    );

    render(<PublicHeader />);

    const desktopControls = screen.getByRole("link", {
      name: /^começar minha jornada$/i,
    }).parentElement;

    expect(desktopControls).toHaveClass("hidden", "xl:flex");
    expect(screen.getByRole("button", { name: "Abrir menu" })).toHaveClass(
      "xl:hidden",
    );
  });

  it("shows the authenticated account actions above mobile navigation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          authenticated: true,
          patient: { displayName: "Vinicius Paciente" },
        }),
        ok: true,
      }),
    );

    render(<PublicHeader />);

    const toggle = screen.getByRole("button", { name: "Abrir menu" });
    fireEvent.click(toggle);

    const mobileMenu = document.getElementById("public-mobile-menu");
    expect(mobileMenu).not.toBeNull();

    await waitFor(() => {
      expect(mobileMenu).toHaveTextContent("Vinicius Paciente");
    });

    expect(
      within(mobileMenu!).getByRole("link", { name: "Meu painel" }),
    ).toHaveAttribute("href", "/app");
    expect(
      within(mobileMenu!).getByRole("link", { name: "Meus encontros" }),
    ).toHaveAttribute("href", "/app/encontros");
    expect(
      within(mobileMenu!).getByRole("button", { name: "Sair" }),
    ).toBeInTheDocument();
    expect(
      within(mobileMenu!).queryByText("Entrar como cliente"),
    ).not.toBeInTheDocument();

    const accountPosition =
      mobileMenu!.textContent!.indexOf("Vinicius Paciente");
    const navigationPosition = mobileMenu!.textContent!.indexOf("Navega");
    expect(accountPosition).toBeGreaterThanOrEqual(0);
    expect(navigationPosition).toBeGreaterThan(accountPosition);
  });

  it("shows login actions in the mobile menu immediately after logout", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          authenticated: true,
          patient: { displayName: "Vinicius Paciente" },
        }),
        ok: true,
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicHeader />);

    const toggle = screen.getByRole("button", { name: "Abrir menu" });
    fireEvent.click(toggle);

    const mobileMenu = document.getElementById("public-mobile-menu");
    expect(mobileMenu).not.toBeNull();
    const mobileMenuQueries = within(mobileMenu!);

    const logoutButton = await mobileMenuQueries.findByRole("button", {
      name: "Sair",
    });
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("/api/auth/client/session", {
        cache: "no-store",
        method: "DELETE",
      });
      expect(
        screen.getByRole("button", { name: "Abrir menu" }),
      ).toHaveAttribute("aria-expanded", "false");
    });

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));

    const updatedMobileMenu = document.getElementById("public-mobile-menu");
    expect(updatedMobileMenu).not.toBeNull();

    expect(
      await within(updatedMobileMenu!).findByRole("link", {
        name: "Entrar como cliente",
      }),
    ).toHaveAttribute("href", "/cliente/login");
    expect(screen.queryByText("Vinicius Paciente")).not.toBeInTheDocument();
  });
});
