import Link from "next/link";
import type { Route } from "next";

import { routes } from "@/lib/routes";

import { PublicLogo } from "./public-header";

const groups: Array<{
  title: string;
  items: Array<{ label: string; href?: Route }>;
}> = [
  {
    title: "Institucional",
    items: [
      { label: "Como funciona", href: routes.public.howItWorks as Route },
      { label: "Terapias", href: routes.public.therapies as Route },
      { label: "Terapeutas", href: routes.public.therapists as Route },
      { label: "Para Terapeutas", href: routes.public.forTherapists as Route },
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
        href: routes.public.therapistPlans as Route,
      },
      { label: "Recursos", href: routes.public.forTherapists as Route },
    ],
  },
  {
    title: "Suporte",
    items: [
      { label: "Central de ajuda", href: routes.public.help as Route },
      { label: "Ajuda com Zoom", href: routes.public.zoomHelp as Route },
      { label: "Contato" },
      { label: "Políticas", href: routes.public.privacy as Route },
    ],
  },
  {
    title: "Legal",
    items: [
      {
        label: "Política de privacidade",
        href: routes.public.privacy as Route,
      },
      { label: "Termos de uso", href: routes.public.terms as Route },
      { label: "LGPD", href: routes.public.privacy as Route },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="mx-auto grid max-w-[1680px] gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[340px_1fr] lg:px-12">
      <div>
        <PublicLogo />
        <p className="mt-4 max-w-xs text-sm font-semibold leading-6 text-tesText-secondary">
          Cuidado integrativo, humano e seguro para cada etapa da sua jornada.
        </p>
        <p className="mt-8 text-sm font-bold text-tesText-muted">
          © 2026 Terapeuta Eu Sou | Todos os direitos reservados
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
      </div>
    </footer>
  );
}
