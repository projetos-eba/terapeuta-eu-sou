import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ZoomMeetingAdapter } from "./zoom-meeting-adapter";

describe("ZoomMeetingAdapter", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps the button disabled outside the join window", () => {
    render(
      <ZoomMeetingAdapter
        bookingId="96000000-0000-4000-8000-000000000001"
        canJoin={false}
        disabledLabel="Disponível 15 min antes"
      />,
    );

    expect(
      screen.getByRole("button", { name: /disponível 15 min antes/i }),
    ).toBeDisabled();
  });

  it("shows a friendly error without rendering tokens", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          error: { message: "A sala ainda esta em preparacao." },
          ok: false,
        }),
        ok: false,
      }),
    );

    render(
      <ZoomMeetingAdapter
        bookingId="96000000-0000-4000-8000-000000000001"
        canJoin
        disabledLabel="Disponível 15 min antes"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    expect(await screen.findByText(/preparacao/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/secret|zak|access_token/i);
  });

  it("does not request access twice while loading", async () => {
    let resolveFetch: (value: unknown) => void = () => undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ZoomMeetingAdapter
        bookingId="96000000-0000-4000-8000-000000000001"
        canJoin
        disabledLabel="Disponivel 15 min antes"
      />,
    );

    const button = screen.getByRole("button", { name: /entrar/i });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch({
      json: async () => ({
        error: { message: "A sala ainda esta em preparacao." },
        ok: false,
      }),
      ok: false,
    });

    expect(await screen.findByText(/preparacao/i)).toBeInTheDocument();
  });
});
