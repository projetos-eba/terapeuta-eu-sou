import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { TherapistProfileGuideItem } from "../therapist-profile-editor.types";
import { ProfileGuideThemePicker } from "./profile-guide-theme-picker";

function Harness({ initial = [] }: { initial?: TherapistProfileGuideItem[] }) {
  const [items, setItems] = useState(initial);
  return <ProfileGuideThemePicker items={items} onChange={setItems} />;
}

describe("ProfileGuideThemePicker", () => {
  afterEach(() => cleanup());

  it("shows the ten platform themes with their selection state", () => {
    render(
      <Harness initial={[{ icon: "heart", label: "Emoções e Bem-Estar" }]} />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(10);
    expect(screen.getByText("1/4 selecionados")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Emoções e Bem-Estar/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("allows up to four themes and explains the limit", () => {
    render(<Harness />);

    fireEvent.click(
      screen.getByRole("button", { name: /Emoções e Bem-Estar/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Relacionamentos/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /Propósito e Direção/ }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /Espiritualidade e Conexão Interior/,
      }),
    );
    expect(screen.getByText("4/4 selecionados")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Energia e Equilíbrio Energético/ }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Você pode escolher até 4 temas.",
    );
    expect(screen.getByText("4/4 selecionados")).toBeInTheDocument();
  });

  it("preserves legacy free-text paths until a platform theme is chosen", () => {
    render(
      <Harness initial={[{ icon: "sparkles", label: "Escuta acolhedora" }]} />,
    );

    expect(
      screen.getByText(/caminhos personalizados salvos anteriormente/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Relacionamentos/ }));

    expect(
      screen.queryByText(/caminhos personalizados salvos anteriormente/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("1/4 selecionados")).toBeInTheDocument();
  });
});
