import { beforeEach, describe, expect, it, vi } from "vitest";

const signupMocks = vi.hoisted(() => ({
  createTherapistAccount: vi.fn(),
}));

vi.mock("@/features/therapist-auth/supabase-rest", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/therapist-auth/supabase-rest")
  >();

  return {
    ...actual,
    createTherapistAccount: signupMocks.createTherapistAccount,
  };
});

import { POST } from "./route";
import { TherapistAuthSupabaseError } from "@/features/therapist-auth/supabase-rest";

describe("therapist signup route", () => {
  beforeEach(() => {
    signupMocks.createTherapistAccount.mockReset();
  });

  it("returns a phone field error for a duplicate therapist phone", async () => {
    signupMocks.createTherapistAccount.mockRejectedValueOnce(
      new TherapistAuthSupabaseError(409, "phone_already_in_use"),
    );

    const response = await POST(
      new Request("https://tes.example.test/api/auth/therapist/signup", {
        body: JSON.stringify({
          birthDate: "1990-01-01",
          confirmPassword: "SenhaSegura123!",
          email: "ana@example.test",
          fullName: "Ana Oliveira",
          password: "SenhaSegura123!",
          phone: "11999999999",
          phoneCountryCode: "55",
          plan: "free",
          termsAccepted: true,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({
      fieldErrors: {
        phone: "Este telefone já está em uso em outra conta de terapeuta.",
      },
      message: "Este telefone já está em uso em outra conta de terapeuta.",
      ok: false,
    });
  });
});
