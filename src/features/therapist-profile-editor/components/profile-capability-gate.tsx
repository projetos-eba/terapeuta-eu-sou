import type { ReactNode } from "react";
import { Lock } from "lucide-react";

import { TESButton } from "@/components/tes";
import { routes } from "@/lib/routes";

export function ProfileCapabilityGate({
  allowed,
  children,
  message,
}: {
  allowed: boolean;
  children: ReactNode;
  message: string;
}) {
  if (allowed) return <>{children}</>;

  return (
    <div className="rounded-lg border border-status-warning/30 bg-status-warningBg p-4">
      <div className="flex gap-3">
        <Lock aria-hidden="true" className="mt-1 text-status-warning" />
        <div>
          <p className="text-sm font-extrabold leading-6 text-brand-deep">
            Recurso bloqueado por plano
          </p>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            {message}
          </p>
          <TESButton
            className="mt-3 min-h-11 rounded-lg"
            href={routes.therapist.plan}
            variant="secondary"
          >
            Ver plano
          </TESButton>
        </div>
      </div>
    </div>
  );
}
