import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TherapistWeekChart, formatWeekdayLabel } from "./therapist-week-chart";

describe("TherapistWeekChart", () => {
  it("keeps weekday formatting stable for local calendar dates", () => {
    expect(formatWeekdayLabel("2026-08-24")).toBe("SEG");
  });

  it("publishes a textual summary of the real series", () => {
    render(
      <TherapistWeekChart
        days={[
          {
            cancelled: 1,
            completed: 2,
            date: "2026-08-24",
            label: "SEG",
            scheduled: 3,
          },
        ]}
      />,
    );

    expect(screen.getByText(/segunda-feira/i)).toHaveTextContent(
      "3 agendadas, 2 realizadas e 1 cancelamentos",
    );
  });
});
