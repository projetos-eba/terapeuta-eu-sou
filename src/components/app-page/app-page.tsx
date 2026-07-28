import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AppPageContainer({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <main
      className={cn(
        "mx-auto grid w-full max-w-[1210px] gap-5 pb-10 text-tesText-primary",
        className,
      )}
      {...props}
    >
      {children}
    </main>
  );
}

export function AppPageHeader({
  actions,
  children,
  className,
  eyebrow,
  title,
  ...props
}: HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  eyebrow?: string;
  title: string;
}) {
  return (
    <header
      className={cn(
        "grid gap-4 rounded-card border border-brand-lavender bg-white p-5 shadow-card sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start",
        className,
      )}
      {...props}
    >
      <div>
        {eyebrow ? (
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-primary">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2 font-display text-[34px] font-light italic leading-tight text-brand-deep sm:text-[44px]">
          {title}
        </h1>
        {children ? (
          <div className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
            {children}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function AppPageGrid({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]", className)}
      {...props}
    />
  );
}

export function AppPageMain({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <section className={cn("grid min-w-0 gap-5", className)} {...props} />;
}

export function AppPageAside({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <aside
      className={cn(
        "grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-1",
        className,
      )}
      {...props}
    />
  );
}

export function AppPageSection({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "rounded-card border border-brand-lavender bg-white p-5 shadow-card sm:p-6",
        className,
      )}
      {...props}
    />
  );
}

export function AppPageActions({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-3 sm:flex-row sm:flex-wrap", className)}
      {...props}
    />
  );
}

export function AppStickySaveBar({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "sticky bottom-3 z-20 rounded-card border border-brand-lavender bg-white/95 p-3 shadow-float backdrop-blur sm:p-4",
        className,
      )}
      {...props}
    />
  );
}
