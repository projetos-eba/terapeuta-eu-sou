import type { HTMLAttributes, ReactNode } from "react";

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
