import type { ReactNode } from "react";

import { TherapistAreaLayout } from "@/features/therapist-shell";

import { logoutTherapist } from "../actions";

export default function PlusLayout({ children }: { children: ReactNode }) {
  return (
    <TherapistAreaLayout logoutAction={logoutTherapist} namespace="plus">
      {children}
    </TherapistAreaLayout>
  );
}
