import { describe, expect, it } from "vitest";

import { getPublicVideoEmbedUrl } from "./video-embed";

const video = (provider: "youtube" | "vimeo" | "external", url: string) => ({
  provider,
  thumbnailUrl: "/thumbnail.png",
  title: "Vídeo de apresentação",
  url,
});

describe("getPublicVideoEmbedUrl", () => {
  it("converts allowlisted YouTube links to privacy-enhanced embeds", () => {
    expect(
      getPublicVideoEmbedUrl(
        video("youtube", "https://www.youtube.com/watch?v=abc123_XYZ"),
      ),
    ).toBe("https://www.youtube-nocookie.com/embed/abc123_XYZ");
    expect(
      getPublicVideoEmbedUrl(video("youtube", "https://youtu.be/abc123_XYZ")),
    ).toBe("https://www.youtube-nocookie.com/embed/abc123_XYZ");
  });

  it("converts Vimeo links to the player host", () => {
    expect(
      getPublicVideoEmbedUrl(video("vimeo", "https://vimeo.com/12345678")),
    ).toBe("https://player.vimeo.com/video/12345678");
  });

  it("does not turn uploads or arbitrary links into iframe sources", () => {
    expect(
      getPublicVideoEmbedUrl(video("external", "https://example.com/video")),
    ).toBeNull();
    expect(
      getPublicVideoEmbedUrl(video("youtube", "https://example.com/video")),
    ).toBeNull();
    expect(getPublicVideoEmbedUrl(null)).toBeNull();
  });
});
