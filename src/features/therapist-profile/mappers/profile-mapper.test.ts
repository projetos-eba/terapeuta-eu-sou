import { describe, expect, it } from "vitest";

import {
  mapContentRow,
  mapProfileRow,
  mapReviewRow,
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

describe("profile review mapper", () => {
  it("maps only the published therapist reply projection", () => {
    expect(
      mapReviewRow({
        author_label: "Paciente TES",
        body: "Experiência compartilhada com cuidado.",
        created_label: "Há uma semana",
        id: "review-1",
        patient_context: "Sessão concluída pela plataforma",
        rating: 5,
        reply_body: "Obrigada pelo retorno.",
        reply_published_at: "2026-07-28T12:00:00.000Z",
      }),
    ).toMatchObject({
      reply: {
        body: "Obrigada pelo retorno.",
        publishedAt: "2026-07-28T12:00:00.000Z",
      },
    });
  });

  it("keeps the reply absent when the public view has no published reply", () => {
    expect(
      mapReviewRow({
        author_label: "Paciente TES",
        body: "Experiência compartilhada.",
        created_label: "Há uma semana",
        id: "review-2",
        patient_context: "Sessão concluída pela plataforma",
        rating: 5,
      }).reply,
    ).toBeNull();
  });
});
