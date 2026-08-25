import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { UsefulInfoCard } from "./useful-info-card";

describe("UsefulInfoCard", () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("opens the answer locally without sending the patient to messages", async () => {
    render(<UsefulInfoCard compact />);

    fireEvent.click(
      screen.getByRole("button", { name: "Como funciona o encontro online?" }),
    );

    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "A sala segura fica disponível",
    );
    expect(screen.queryByRole("link", { name: /mensagens/i })).toBeNull();
  });

  it("closes the answer with Escape", async () => {
    render(<UsefulInfoCard />);

    const question = screen.getByRole("button", {
      name: "Como reagendar meu encontro?",
    });
    fireEvent.click(question);
    expect(await screen.findByRole("dialog")).toBeVisible();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(question).toHaveFocus();
  });
});
