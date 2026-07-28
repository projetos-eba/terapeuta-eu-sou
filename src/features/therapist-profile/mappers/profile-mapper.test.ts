import { describe, expect, it } from "vitest";

import {
  mapContentRow,
  mapProfileRow,
  type ProfileRow,
} from "./profile-mapper";

const baseRow: ProfileRow = {
  accepts_online_sessions: true,
  average_rating: null,
  badges: [],
  bio: null,
  city: "São Paulo",
  id: "profile-1",
  is_accepting_bookings: true,
  is_verified: true,
  photo_url: null,
  plan: "premium",
  public_name: "Ana Oliveira",
  published_headline: null,
  review_count: 0,
  sessions_completed: 0,
  short_intro: "Escuta responsável.",
  slug: "ana-oliveira",
  state: "SP",
  tags: ["Reiki"],
  video_provider: "youtube",
  video_thumbnail_url: null,
  video_title: null,
  video_url: null,
};

describe("profile video mapper", () => {
  it("drops empty and invalid video URLs instead of exposing broken links", () => {
    const content = mapContentRow(null);

    expect(mapProfileRow(baseRow, content, []).video).toBeNull();
    expect(
      mapProfileRow(
        {
          ...baseRow,
          video_url: "notaurl",
        },
        content,
        [],
      ).video,
    ).toBeNull();
    expect(
      mapProfileRow(
        {
          ...baseRow,
          video_url: "http://example.test/video",
        },
        content,
        [],
      ).video,
    ).toBeNull();
  });

  it("keeps a supported https video URL", () => {
    const profile = mapProfileRow(
      {
        ...baseRow,
        video_title: "Um convite para você",
        video_url: "https://example.test/video",
      },
      mapContentRow(null),
      [],
    );

    expect(profile.video).toEqual({
      provider: "youtube",
      thumbnailUrl: "/home/tablet-video-session.png",
      title: "Um convite para você",
      url: "https://example.test/video",
    });
  });
});
