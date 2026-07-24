import type { ReactNode } from "react";

import { TherapistAreaLayout } from "@/features/therapist-shell";

import { logoutTherapist } from "../actions";

export default function BasicLayout({ children }: { children: ReactNode }) {
  return (
    <TherapistAreaLayout logoutAction={logoutTherapist} namespace="basico">
      {children}
    </TherapistAreaLayout>
  );
}
