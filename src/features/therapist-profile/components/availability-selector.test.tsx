import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { TherapistProfileService } from "../types";
import { AvailabilitySelector } from "./availability-selector";

function createService(
  overrides: Pick<
    TherapistProfileService,
    | "durationMinutes"
    | "id"
    | "priceCents"
    | "priceLabel"
    | "therapyId"
    | "therapyName"
    | "therapySlug"
  > & { slotTime: string; slotStartsAt: string },
): TherapistProfileService {
  return {
    availability: [
      {
        date: "2026-09-01",
        dateLabel: "01/09",
        dayLabel: "ter",
        slots: [
          {
            dateLabel: "01/09",
            dayLabel: "ter",
            endsAt: new Date(
              new Date(overrides.slotStartsAt).getTime() +
                overrides.durationMinutes * 60_000,
            ).toISOString(),
            serviceId: overrides.id,
            startsAt: overrides.slotStartsAt,
            timeLabel: overrides.slotTime,
          },
        ],
      },
    ],
    bookingUrl: `/reserva?service=${overrides.id}`,
    currency: "BRL",
    description: `${overrides.therapyName} online`,
    durationMinutes: overrides.durationMinutes,
    id: overrides.id,
    imageUrl: null,
    priceCents: overrides.priceCents,
    priceLabel: overrides.priceLabel,
    themeNames: [],
    therapyId: overrides.therapyId,
    therapyName: overrides.therapyName,
    therapySlug: overrides.therapySlug,
    title: `${overrides.therapyName} online`,
  };
}

const reiki = createService({
  durationMinutes: 20,
  id: "service-reiki",
  priceCents: 12_000,
  priceLabel: "R$ 120",
  slotStartsAt: "2026-09-01T12:00:00.000Z",
  slotTime: "09:00",
  therapyId: "therapy-reiki",
  therapyName: "Reiki",
  therapySlug: "reiki",
});

const tarot = createService({
  durationMinutes: 30,
  id: "service-tarot",
  priceCents: 12_200,
  priceLabel: "R$ 122",
  slotStartsAt: "2026-09-01T13:15:00.000Z",
  slotTime: "10:15",
  therapyId: "therapy-tarot",
  therapyName: "Tarô",
  therapySlug: "taro",
});

describe("AvailabilitySelector", () => {
  afterEach(cleanup);

  it("switches Reiki to Tarô and back without retaining stale service data", () => {
    render(
      <AvailabilitySelector
        services={[reiki, tarot]}
        therapistSlug="antonio-ferrari-e2e"
      />,
    );

    expect(screen.getByText("Reiki · 20 min · R$ 120")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "09:00" })).toHaveAttribute(
      "href",
      expect.stringContaining("service=service-reiki"),
    );
    expect(screen.queryByRole("link", { name: "10:15" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Tarô" }));

    expect(screen.getByText("Tarô · 30 min · R$ 122")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "10:15" })).toHaveAttribute(
      "href",
      expect.stringContaining("service=service-tarot"),
    );
    expect(screen.queryByRole("link", { name: "09:00" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reiki" }));

    expect(screen.getByText("Reiki · 20 min · R$ 120")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "09:00" })).toHaveAttribute(
      "href",
      expect.stringContaining("service=service-reiki"),
    );
    expect(screen.queryByRole("link", { name: "10:15" })).toBeNull();
  });
});
