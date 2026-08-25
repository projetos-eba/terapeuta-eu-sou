import type { HTMLAttributes, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export function ProfileSection({
  children,
  className,
  description,
  title,
  ...props
}: HTMLAttributes<HTMLElement> & {
  description?: string;
  title?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-card border border-brand-lavender/70 bg-white p-5 shadow-card sm:p-6",
        className,
      )}
      {...props}
    >
      {title ? (
        <div className="mb-5">
          <h2 className="text-lg font-extrabold leading-7 text-brand-deep">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function ProfileInfoBanner({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <ProfileSection className="grid gap-4 sm:grid-cols-[52px_1fr] sm:items-center">
      <div className="grid size-[52px] place-items-center rounded-full bg-brand-lavenderSoft text-brand-deep">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-extrabold leading-6 text-brand-deep">
          {title}
        </h2>
        <div className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          {children}
        </div>
      </div>
    </ProfileSection>
  );
}

export function ProfileReviewNotice({ reason }: { reason: string }) {
  return (
    <ProfileSection
      className="border-status-warning/40 bg-status-warningBg/45"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-status-warning">
          <AlertCircle aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-extrabold leading-6 text-brand-deep">
            Correções solicitadas pela equipe TES
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            Revise a justificativa abaixo e atualize seu perfil antes de enviar
            uma nova publicação.
          </p>
          <p className="mt-4 rounded-2xl border border-status-warning/30 bg-white p-4 text-sm font-semibold leading-6 text-brand-deep">
            {reason}
          </p>
        </div>
      </div>
    </ProfileSection>
  );
}
