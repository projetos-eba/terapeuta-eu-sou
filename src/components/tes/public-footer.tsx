import type { Route } from "next";
import Link from "next/link";
import { Building2, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";

import { getPublicSocialLinks } from "@/config/public-social-links";
import {
  getLegalDocument,
  isDocumentPublishable,
  isSupportMatrixPublishable,
} from "@/domain/legal/legal-registry";
import { routes } from "@/lib/routes";

import { PublicLogo } from "./public-header";

type FooterGroup = {
  items: Array<{ href?: Route; label: string }>;
  title: string;
};

export function PublicFooter({ variant = "default" }: { variant?: "default" | "profile" } = {}) {
  const socialLinks = getPublicSocialLinks();
  const groups = getFooterGroups();
  const isProfile = variant === "profile";

  return (
    <footer
      className={
        isProfile
          ? "mx-5 grid max-w-[1680px] gap-10 rounded-[22px] border border-brand-lavender bg-white/90 px-6 py-8 shadow-card sm:mx-8 sm:p-10 lg:mx-auto lg:w-auto lg:grid-cols-[360px_1fr] lg:rounded-none lg:border-0 lg:bg-transparent lg:px-12 lg:py-10 lg:shadow-none"
          : "mx-auto grid max-w-[1680px] gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[360px_1fr] lg:px-12"
      }
    >
      <div>
        <PublicLogo />
        <p className="mt-4 max-w-sm text-sm font-semibold leading-6 text-tesText-secondary">
          Onde terapeutas encontram espaço e pessoas encontram caminhos.
        </p>
        <p
          className={
            isProfile
              ? "mt-8 hidden max-w-[260px] text-sm font-bold leading-6 text-tesText-muted sm:max-w-none lg:block"
              : "mt-8 max-w-[260px] text-sm font-bold leading-6 text-tesText-muted sm:max-w-none"
          }
        >
          © 2026 Terapeuta Eu Sou. Todos os direitos reservados.
        </p>
      </div>
      <div
        className={
          isProfile
            ? "grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4 lg:gap-8"
            : "grid gap-8 sm:grid-cols-2 lg:grid-cols-4"
        }
      >
        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="flex items-center gap-3 text-base font-extrabold text-brand-deep">
              {isProfile ? <FooterGroupIcon title={group.title} /> : null}
              {group.title}
            </h3>
            <ul className="mt-4 space-y-2">
              {group.items.map((item) => (
                <li key={item.label}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="text-sm font-semibold text-tesText-secondary transition hover:text-brand-primary"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold text-tesText-muted">
                      {item.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {socialLinks.length ? (
          <div>
            <h3 className="text-base font-extrabold text-brand-deep">
              Redes sociais
            </h3>
            <ul className="mt-4 flex flex-wrap gap-3">
              {socialLinks.map((item) => {
                const Icon = item.icon;

                return (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      aria-label={item.label}
                      className="grid size-11 place-items-center rounded-full border border-brand-lavender/60 bg-white text-brand-primary shadow-[0_8px_24px_rgba(108,61,145,0.08)] transition hover:-translate-y-0.5 hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <Icon className="size-5" aria-hidden="true" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
      {isProfile ? (
        <p className="text-center text-sm font-bold leading-6 text-tesText-muted lg:hidden">
          © 2026 Terapeuta Eu Sou. Todos os direitos reservados.
        </p>
      ) : null}
    </footer>
  );
}

function FooterGroupIcon({ title }: { title: string }) {
  const Icon: LucideIcon =
    title === "Institucional"
      ? Building2
      : title === "Para terapeutas"
        ? UserRound
        : ShieldCheck;

  return (
    <Icon
      aria-hidden="true"
      className="size-5 shrink-0 text-brand-primary lg:hidden"
    />
  );
}

function getFooterGroups(): FooterGroup[] {
  const legalItems: FooterGroup["items"] = [];

  if (isDocumentPublishable(getLegalDocument("privacy-policy"))) {
    legalItems.push({
      href: routes.public.privacy as Route,
      label: "Política de privacidade",
    });
  }

  if (isDocumentPublishable(getLegalDocument("terms-of-use"))) {
    legalItems.push({
      href: routes.public.terms as Route,
      label: "Termos de uso",
    });
  }

  if (
    isDocumentPublishable(
      getLegalDocument("cancellation-reschedule-refund-policy"),
    )
  ) {
    legalItems.push({
      href: routes.public.cancellationPolicy as Route,
      label: "Cancelamento e reembolso",
    });
  }

  if (isSupportMatrixPublishable()) {
    legalItems.push({ href: routes.public.help as Route, label: "Ajuda" });
  }

  return [
    {
      title: "Institucional",
      items: [
        { label: "O que é o TES?", href: routes.public.about as Route },
        { label: "Terapias", href: routes.public.therapies as Route },
        { label: "Terapeutas", href: routes.public.therapists as Route },
        { label: "Sua Jornada", href: routes.public.journey as Route },
      ],
    },
    {
      title: "Para terapeutas",
      items: [
        {
          label: "Seja um terapeuta",
          href: routes.public.therapistSignUp as Route,
        },
        {
          label: "Planos e benefícios",
          href: routes.public.forTherapists as Route,
        },
      ],
    },
    {
      title: "Suporte e legal",
      items: legalItems,
    },
  ];
}
