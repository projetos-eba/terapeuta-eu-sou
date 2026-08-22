import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const router = {
  refresh: vi.fn(),
  replace: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

import { PublicAuthMenu } from "./public-auth-menu";

describe("PublicAuthMenu", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    router.refresh.mockReset();
    router.replace.mockReset();
  });

  it("logs out authenticated clients from the public header menu", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          authenticated: true,
          patient: { displayName: "Carlos" },
        }),
        ok: true,
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    vi.stubGlobal("fetch", fetchMock);

    render(<PublicAuthMenu />);

    expect(await screen.findByText("Olá, Carlos")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("/api/auth/client/session", {
        cache: "no-store",
        method: "DELETE",
      });
    });

    expect(router.replace).toHaveBeenCalledWith("/");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("shows and logs out an authenticated therapist on the public home", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ authenticated: false }),
        ok: true,
      })
      .mockResolvedValueOnce({
        json: async () => ({
          authenticated: true,
          therapist: { displayName: "Ana Oliveira" },
        }),
        ok: true,
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    vi.stubGlobal("fetch", fetchMock);

    render(<PublicAuthMenu />);

    expect(await screen.findByText("Olá, Ana")).toBeInTheDocument();
    expect(screen.getByText("Conta terapeuta")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("/api/auth/therapist/session", {
        cache: "no-store",
        method: "DELETE",
      });
    });

    expect(router.replace).toHaveBeenCalledWith("/");
    expect(router.refresh).toHaveBeenCalled();
  });
});
