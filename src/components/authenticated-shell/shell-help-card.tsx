import Link from "next/link";
import type { Route } from "next";
import { Headphones } from "lucide-react";

export function ShellHelpCard({
  href,
  label = "Fale conosco",
}: {
  href: string;
  label?: string;
}) {
  return (
    <section className="rounded-[14px] border border-[var(--tes-color-border)] bg-white p-4">
      <div className="flex items-start gap-3">
        <Headphones aria-hidden="true" className="mt-0.5 size-5 text-brand-primary" />
        <div>
          <h2 className="text-sm font-semibold text-[var(--tes-color-primary-dark)]">
            Precisa de ajuda?
          </h2>
          <p className="mt-2 text-xs leading-5 text-[var(--tes-color-text-secondary-app)]">
            Nossa equipe está aqui para apoiar você.
          </p>
        </div>
      </div>
      <Link
        className="mt-4 flex min-h-10 items-center justify-center rounded-sm bg-brand-primary px-3 text-xs font-medium text-white outline-none transition hover:bg-brand-primaryHover focus-visible:ring-4 focus-visible:ring-ring/20"
        href={href as Route<string>}
      >
        {label}
      </Link>
    </section>
  );
}
