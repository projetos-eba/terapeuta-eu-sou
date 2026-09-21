import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MobileMediaRecoveryNotice } from "./mobile-media-recovery-notice";

describe("MobileMediaRecoveryNotice", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers the existing support action and disappears after ten seconds", () => {
    vi.useFakeTimers();
    const onOpenSupport = vi.fn();

    render(<MobileMediaRecoveryNotice onOpenSupport={onOpenSupport} />);

    expect(
      screen.getByText("Câmera ou áudio com problema?"),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Falar com o suporte" }));
    expect(onOpenSupport).toHaveBeenCalledOnce();

    act(() => vi.advanceTimersByTime(10_000));

    expect(
      screen.queryByText("Câmera ou áudio com problema?"),
    ).not.toBeInTheDocument();
  });
});
