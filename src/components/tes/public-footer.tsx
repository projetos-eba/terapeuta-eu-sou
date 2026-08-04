import type { Route } from "next";
import Link from "next/link";

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

export function PublicFooter() {
  const socialLinks = getPublicSocialLinks();
  const groups = getFooterGroups();

  return (
    <footer className="mx-auto grid max-w-[1680px] gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[360px_1fr] lg:px-12">
      <div>
        <PublicLogo />
        <p className="mt-4 max-w-sm text-sm font-semibold leading-6 text-tesText-secondary">
          Onde terapeutas encontram espaço e pessoas encontram caminhos.
        </p>
        <p className="mt-8 max-w-[260px] text-sm font-bold leading-6 text-tesText-muted sm:max-w-none">
          © 2026 Terapeuta Eu Sou. Todos os direitos reservados.
        </p>
      </div>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="text-base font-extrabold text-brand-deep">
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
    </footer>
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
