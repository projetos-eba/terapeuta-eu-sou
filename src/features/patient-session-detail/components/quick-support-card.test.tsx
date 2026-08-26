import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QuickSupportCard } from "./quick-support-card";

describe("QuickSupportCard", () => {
  it("keeps the support surface fluid inside the contextual layout", () => {
    render(<QuickSupportCard bookingId="booking-1" />);

    expect(
      screen.getByRole("heading", { name: "Suporte rápido" }).closest("section"),
    ).toHaveClass("w-full", "min-w-0");
  });
});
