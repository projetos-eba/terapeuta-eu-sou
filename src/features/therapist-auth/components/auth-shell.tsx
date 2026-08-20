import type { ReactNode } from "react";

import { PublicLogo, TESDecorativeMedia } from "@/components/tes";
import { platformAssets } from "@/lib/platform-assets";
import { cn } from "@/lib/utils";

export function TherapistAuthShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="min-h-screen bg-surface-soft px-5 py-8 text-brand-deep sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col items-center justify-center gap-8">
        <PublicLogo />
        <section className="grid w-full overflow-hidden rounded-hero border border-border bg-surface-default shadow-float lg:grid-cols-[0.92fr_1.08fr]">
          <aside className="pointer-events-none relative isolate order-2 min-h-[360px] overflow-hidden bg-brand-primary sm:min-h-[440px] lg:order-1 lg:min-h-[760px]">
            <TESDecorativeMedia
              className="inset-0 opacity-75"
              fade="none"
              imageClassName="scale-110 object-cover sm:scale-125 lg:scale-110"
              objectPosition="center"
              priority
              sizes="(min-width: 1024px) 530px, 100vw"
              src={platformAssets.therapistLoginIcon.src}
            />
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
