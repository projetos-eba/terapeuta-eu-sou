import type { ReactNode } from "react";

import { TherapistAreaLayout } from "@/features/therapist-shell";

import { logoutTherapist } from "../actions";

export default function ProLayout({ children }: { children: ReactNode }) {
  return (
    <TherapistAreaLayout logoutAction={logoutTherapist} namespace="pro">
      {children}
    </TherapistAreaLayout>
  );
}
