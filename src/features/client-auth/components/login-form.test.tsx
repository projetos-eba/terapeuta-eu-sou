import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminLoginForm } from "@/features/admin-auth/components/admin-login-form";
import { TherapistLoginForm } from "@/features/therapist-auth/components/login-form";

import { ClientLoginForm } from "./login-form";

describe("critical login form fallback methods", () => {
  it.each(["client", "therapist", "admin"])(
    "uses POST for the %s login form",
    (role) => {
      const { container } = render(
        role === "client" ? (
          <ClientLoginForm created={false} />
        ) : role === "therapist" ? (
          <TherapistLoginForm created={false} />
        ) : (
          <AdminLoginForm />
        ),
      );

      expect(container.querySelector("form")).toHaveAttribute("method", "post");
    },
  );

  it.each(["client", "therapist", "admin"])(
    "shows and hides the password in the %s login form",
    (role) => {
      const { container } = render(
        role === "client" ? (
          <ClientLoginForm created={false} />
        ) : role === "therapist" ? (
          <TherapistLoginForm created={false} />
        ) : (
          <AdminLoginForm />
        ),
      );
      const password = container.querySelector<HTMLInputElement>(
        'input[name="password"]',
      );
      const form = container.querySelector("form");

      expect(form).not.toBeNull();
      if (!form) return;

      expect(password).toHaveAttribute("type", "password");
      fireEvent.click(within(form).getByRole("button", { name: "Mostrar senha" }));
      expect(password).toHaveAttribute("type", "text");
      expect(
        within(form).getByRole("button", { name: "Ocultar senha" }),
      ).toHaveAttribute("aria-pressed", "true");
    },
  );
});
