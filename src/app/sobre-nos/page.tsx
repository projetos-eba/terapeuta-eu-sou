import type { Metadata } from "next";
import Link from "next/link";

import { PublicFooter } from "@/components/tes/public-footer";
import { PublicHeader } from "@/components/tes/public-header";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Sobre nós | Terapeuta Eu Sou",
  description:
    "Conheça a proposta do Terapeuta Eu Sou para aproximar pessoas e terapeutas em uma experiência online, cuidadosa e segura.",
};

export default function AboutUsPage() {
  return (
    <main className="min-h-screen bg-surface-soft text-brand-deep">
      <PublicHeader />
      <section className="mx-auto grid max-w-[1240px] gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-12 lg:py-24">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-brand-primary">
            Sobre nós
          </p>
          <h1 className="mt-5 font-display text-5xl font-light italic leading-tight text-brand-deep sm:text-6xl lg:text-7xl">
            Onde terapeutas encontram espaço e pessoas encontram caminhos.
          </h1>
        </div>
        <div className="space-y-6 text-base font-semibold leading-8 text-tesText-secondary sm:text-lg">
          <p>
            O Terapeuta Eu Sou nasceu para organizar a conexão entre pessoas que
            buscam cuidado e profissionais que oferecem práticas terapêuticas
            online com responsabilidade.
          </p>
          <p>
            A plataforma reúne descoberta, agenda, reserva, pagamento e encontro
            online em um fluxo pensado para reduzir ruído, preservar segurança e
            dar clareza a cada etapa da jornada.
          </p>
          <p>
            Não prometemos cura, diagnóstico ou resultado. Nosso compromisso é
            criar um ambiente digital cuidadoso, com regras claras, dados
            protegidos e experiências consistentes para pacientes e terapeutas.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href={routes.public.journey}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-primary px-6 text-sm font-extrabold text-white shadow-soft transition hover:bg-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            >
              Começar minha jornada
            </Link>
            <Link
              href={routes.public.forTherapists}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-brand-lavender bg-white px-6 text-sm font-extrabold text-brand-primary transition hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            >
              Para terapeutas
            </Link>
          </div>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
