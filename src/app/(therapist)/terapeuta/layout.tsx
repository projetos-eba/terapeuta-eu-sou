import type { ReactNode } from "react";

import { TherapistAreaLayout } from "@/features/therapist-shell";

import { logoutTherapist } from "../actions";

export default function TherapistLayout({ children }: { children: ReactNode }) {
  return (
    <TherapistAreaLayout logoutAction={logoutTherapist}>
      {children}
    </TherapistAreaLayout>
  );
}
