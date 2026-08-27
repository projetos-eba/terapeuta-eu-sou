import { describe, expect, it } from "vitest";

import { getPublicProfileDesktopPreviewLayout } from "./public-profile-desktop-preview";

describe("getPublicProfileDesktopPreviewLayout", () => {
  it.each([
    [1440, 3200, 1, 3200],
    [1024, 3200, 1024 / 1440, 2276],
    [360, 3200, 0.25, 800],
    [1800, 3200, 1, 3200],
  ])(
    "fits a %ipx viewport without cropping the %ipx desktop canvas",
    (viewportWidth, canvasHeight, scale, height) => {
      expect(
        getPublicProfileDesktopPreviewLayout(viewportWidth, canvasHeight),
      ).toEqual({ height, scale });
    },
  );
});
