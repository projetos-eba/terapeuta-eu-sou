import type { ReactNode } from "react";

import { TherapistPlan } from "@/domain/tes";
import { TherapistLockedCard } from "@/features/therapist-access";

export function ProfileCapabilityGate({
  allowed,
  children,
  message,
  requiredPlan = TherapistPlan.PremiumPlus,
  title = "Recurso bloqueado por plano",
}: {
  allowed: boolean;
  children: ReactNode;
  message: string;
  requiredPlan?: TherapistPlan;
  title?: string;
}) {
  if (allowed) return <>{children}</>;

  return (
    <TherapistLockedCard
      description={message}
      requiredPlan={requiredPlan}
      title={title}
      variant="compact"
    />
  );
}
