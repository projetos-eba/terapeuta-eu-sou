import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const actionMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());

vi.mock("../therapist-aura.actions", () => ({
  dismissAuraRecommendationAction: actionMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { TherapistAuraDismissForm } from "./therapist-aura-dismiss-form";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TherapistAuraDismissForm", () => {
  it("keeps the recommendation available and exposes a retryable error", async () => {
    actionMock.mockResolvedValue({
      message: "Não foi possível dispensar agora.",
      status: "error",
    });

    renderForm();
    fireEvent.submit(screen.getByRole("button"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível dispensar agora.",
    );
    expect(screen.getByRole("button")).toBeEnabled();
    expect(
      screen.getByDisplayValue("aura.reviews.pending_reply.v1:key"),
    ).toBeInTheDocument();
    const form = screen.getByRole("button").closest("form");
    expect(form?.querySelector('[name="ruleKey"]')).toBeNull();
    expect(form?.querySelector('[name="ruleVersion"]')).toBeNull();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("shows success and refreshes the server-backed card", async () => {
    actionMock.mockResolvedValue({
      message: "Recomendação dispensada nesta janela.",
      status: "success",
    });

    renderForm();
    fireEvent.submit(screen.getByRole("button"));

    expect(
      await screen.findByText("Recomendação dispensada nesta janela."),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("status")
        .some((element) =>
          element.textContent?.includes(
            "Recomendação dispensada nesta janela.",
          ),
        ),
    ).toBe(true);
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("disables the submit control while a dismiss is in flight", async () => {
    let resolveAction:
      | ((value: { status: "success"; message: string }) => void)
      | undefined;
    actionMock.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );

    renderForm();
    const button = screen.getByRole("button");
    fireEvent.submit(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(actionMock).toHaveBeenCalledTimes(1);

    resolveAction?.({
      message: "Recomendação dispensada nesta janela.",
      status: "success",
    });
  });
});

function renderForm() {
  return render(
    <TherapistAuraDismissForm
      periodEnd="2026-08-24T03:00:00.000Z"
      periodStart="2026-07-25T03:00:00.000Z"
      recommendationKey="aura.reviews.pending_reply.v1:key"
      recommendationTitle="Avaliações aguardam uma resposta"
    />,
  );
}
