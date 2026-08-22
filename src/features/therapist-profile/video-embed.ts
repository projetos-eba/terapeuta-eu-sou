import type { PublicTherapistProfile } from "./types";

/**
 * Returns an embed URL only for providers explicitly allowed by the profile
 * contract. Arbitrary external URLs never become iframe sources.
 */
export function getPublicVideoEmbedUrl(
  video: PublicTherapistProfile["video"],
): string | null {
  if (!video || (video.provider !== "youtube" && video.provider !== "vimeo")) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(video.url);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  const hostname = url.hostname.replace(/^www\./, "").toLowerCase();

  if (video.provider === "youtube") {
    const id = youtubeVideoId(hostname, url);
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }

  const id = vimeoVideoId(hostname, url);
  return id ? `https://player.vimeo.com/video/${id}` : null;
}

function youtubeVideoId(hostname: string, url: URL) {
  let id = "";
  if (hostname === "youtu.be") {
    id = url.pathname.split("/").filter(Boolean)[0] ?? "";
  } else if (hostname === "youtube.com") {
    if (url.pathname === "/watch") {
      id = url.searchParams.get("v") ?? "";
    } else if (url.pathname.startsWith("/shorts/")) {
      id = url.pathname.split("/")[2] ?? "";
    } else if (url.pathname.startsWith("/embed/")) {
      id = url.pathname.split("/")[2] ?? "";
    }
  }
  return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
}

function vimeoVideoId(hostname: string, url: URL) {
  if (hostname !== "vimeo.com" && hostname !== "player.vimeo.com") {
    return null;
  }
  const segments = url.pathname.split("/").filter(Boolean);
  const id = segments.at(-1) ?? "";
  return /^\d{6,12}$/.test(id) ? id : null;
}
