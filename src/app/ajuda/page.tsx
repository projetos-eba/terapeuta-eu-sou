import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { Headphones, Video } from "lucide-react";

import { HelpSearch } from "@/features/public-support/help-search";
import { PublicInfoLayout } from "@/features/public-support/public-info-layout";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  description: "Central de ajuda pública do Terapeuta Eu Sou.",
  title: "Ajuda | Terapeuta Eu Sou",
};

export default function PublicHelpPage() {
  return (
    <PublicInfoLayout eyebrow="Central de ajuda" title="Como podemos ajudar?">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <HelpSearch />
        <aside className="rounded-card border border-brand-lavender bg-white p-6 shadow-card">
          <Headphones
            aria-hidden="true"
            className="text-brand-primary"
            size={28}
          />
          <h2 className="mt-4 text-xl font-extrabold text-brand-deep">
            Suporte
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            Para assuntos da sua conta, acesse a área logada correspondente e
            use o suporte interno. Canais externos não foram identificados nos
            arquivos analisados.
          </p>
          <Link
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white"
            href={routes.public.zoomHelp as Route}
          >
            <Video aria-hidden="true" size={18} />
            Ajuda com Zoom
          </Link>
        </aside>
      </div>
    </PublicInfoLayout>
  );
}
