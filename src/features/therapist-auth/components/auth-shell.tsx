import type { ReactNode } from "react";

import { AuthBackButton, PublicLogo, TESDecorativeMedia } from "@/components/tes";
import { routes } from "@/lib/routes";
import { platformAssets } from "@/lib/platform-assets";
import { cn } from "@/lib/utils";

export function TherapistAuthShell({
  alwaysFallback = false,
  children,
  className,
  eyebrow,
  title,
}: {
  alwaysFallback?: boolean;
  children: ReactNode;
  className?: string;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="relative min-h-screen bg-surface-soft px-5 py-8 text-brand-deep sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col items-center justify-center gap-8">
        <div className="relative flex w-full justify-center">
          <AuthBackButton
            alwaysFallback={alwaysFallback}
            fallbackHref={routes.public.home}
          />
          <PublicLogo />
        </div>
        <section className="grid w-full overflow-hidden rounded-hero border border-border bg-surface-default shadow-float lg:grid-cols-[0.92fr_1.08fr]">
          <aside className="pointer-events-none relative isolate order-2 min-h-[360px] overflow-hidden bg-brand-primary sm:min-h-[440px] lg:order-1 lg:min-h-[760px]">
            <TESDecorativeMedia
              className="inset-0 opacity-75"
              fade="none"
              imageClassName="object-cover"
              objectPosition="center"
              priority
              sizes="(min-width: 1024px) 530px, 100vw"
              src={platformAssets.therapistLoginBackground.src}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-b from-brand-primary/55 via-brand-primary/10 to-transparent"
            />
            <div className="relative z-10 flex h-full flex-col items-center px-8 pt-14 text-center text-white sm:px-12 sm:pt-16 lg:px-10 lg:pt-16">
              <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-white/95">
                {eyebrow}
              </p>
              <h2 className="mt-5 max-w-[12ch] font-display text-4xl font-light italic leading-[0.98] text-white sm:text-5xl lg:text-[3.5rem]">
                {title}
              </h2>
            </div>
          </aside>

          <div
            className={cn(
              "relative z-10 order-1 flex flex-col justify-center px-6 py-7 sm:px-10 sm:py-10 lg:order-2 lg:px-20",
              className,
            )}
          >
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
