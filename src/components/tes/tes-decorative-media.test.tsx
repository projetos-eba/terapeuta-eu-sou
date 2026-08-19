import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TESDecorativeMedia } from "./tes-decorative-media";

describe("TESDecorativeMedia", () => {
  it("renders a decorative image with the requested directional fade", () => {
    const { container } = render(
      <TESDecorativeMedia
        fade="left"
        fadeTone="soft"
        sizes="(min-width: 1024px) 50vw, 100vw"
        src="/assets/plataforma/example.png"
      />,
    );

    expect(
      decodeURIComponent(screen.getByAltText("").getAttribute("src")!),
    ).toContain("/assets/plataforma/example.png");
    expect(container.firstChild).toHaveAttribute("data-fade", "left");
    expect(container.firstChild).not.toHaveClass("inset-0");
    const fade = container.querySelector("span");

    expect(fade).not.toBeNull();
    expect(fade?.className).toContain("_14%");
    expect(fade?.className).toContain("_34%");
    expect(fade?.className).not.toContain("_64%");
  });

  it("does not add an overlay when no fade is requested", () => {
    const { container } = render(
      <TESDecorativeMedia
        fade="none"
        sizes="240px"
        src="/assets/plataforma/example.png"
      />,
    );

    expect(container.firstChild).toHaveAttribute("data-fade", "none");
    expect(container.querySelector("span")).toBeNull();
  });
});
