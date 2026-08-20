import { render } from "@testing-library/react";
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
});
