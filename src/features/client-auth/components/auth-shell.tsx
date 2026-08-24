import Image from "next/image";
import type { ReactNode } from "react";

import { AuthBackButton, PublicLogo } from "@/components/tes";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function ClientAuthShell({
  alwaysFallback = false,
  children,
  className,
}: {
  alwaysFallback?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className="relative min-h-screen bg-[radial-gradient(circle_at_top,#F4ECFA_0%,#FFFFFF_42%,#F8F5FF_100%)] px-5 py-8 text-brand-deep sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col items-center justify-center gap-8">
        <div className="relative flex w-full justify-center">
          <AuthBackButton
            alwaysFallback={alwaysFallback}
            fallbackHref={routes.public.home}
          />
          <PublicLogo />
        </div>
        <section className="grid w-full overflow-hidden rounded-[28px] border border-border bg-white shadow-float lg:grid-cols-[1.02fr_0.98fr]">
          <div
            className={cn(
              "relative z-10 order-1 px-6 py-7 sm:px-10 sm:py-10",
              className,
            )}
          >
            {children}
          </div>

          <aside className="relative z-0 order-2 min-h-[320px] bg-brand-lavenderSoft p-4 lg:min-h-[720px] lg:p-5">
            <div className="relative h-full min-h-[320px] overflow-hidden rounded-[22px]">
              <Image
                src="/client-auth/client-auth-journey-room.png"
                alt="Ambiente acolhedor para iniciar sua jornada"
                fill
                sizes="(min-width: 1024px) 520px, 100vw"
                className="object-cover"
                priority
              />
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
