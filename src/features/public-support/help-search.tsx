"use client";

import Link from "next/link";
import type { Route } from "next";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { routes } from "@/lib/routes";

const topics = [
  {
    category: "Sessões online",
    href: routes.public.zoomHelp,
    summary: "Câmera, microfone, sala de espera e conexão.",
    title: "Entrar em uma sessão pelo Zoom",
  },
  {
    category: "Conta",
    summary: "Use as rotas de login de cliente ou terapeuta.",
    title: "Acessar minha conta",
  },
  {
    category: "Pagamento",
    summary: "A confirmação depende do processamento seguro do Stripe.",
    title: "Pagamento de sessão",
  },
  {
    category: "Privacidade",
    href: routes.public.privacy,
    summary: "Uso mínimo de dados para operação da chamada.",
    title: "Dados e videoconferência",
  },
];

export function HelpSearch() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return topics;

    return topics.filter((topic) =>
      `${topic.category} ${topic.title} ${topic.summary}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [query]);

  return (
    <section className="rounded-card border border-brand-lavender bg-white p-6 shadow-card">
      <label
        className="text-sm font-extrabold text-brand-deep"
        htmlFor="help-search"
      >
        Buscar na ajuda
      </label>
      <div className="mt-3 flex min-h-12 items-center gap-3 rounded-xl border border-brand-lavender bg-surface-soft px-4">
        <Search aria-hidden="true" className="text-brand-primary" size={18} />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-tesText-primary outline-none placeholder:text-tesText-muted"
          id="help-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ex.: câmera, pagamento, privacidade"
          value={query}
        />
      </div>

      <div className="mt-6 grid gap-3">
        {filtered.map((topic) =>
          topic.href ? (
            <Link
              className="rounded-2xl border border-brand-lavender bg-white p-4 transition hover:border-brand-primary"
              href={topic.href as Route}
              key={topic.title}
            >
              <Topic topic={topic} />
            </Link>
          ) : (
            <div
              className="rounded-2xl border border-brand-lavender bg-white p-4"
              key={topic.title}
            >
              <Topic topic={topic} />
            </div>
          ),
        )}
        {filtered.length === 0 ? (
          <p className="rounded-2xl bg-surface-soft p-4 text-sm font-semibold text-tesText-secondary">
            Nenhum tópico encontrado. Acesse sua área logada para acionar o
            suporte.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Topic({
  topic,
}: {
  topic: { category: string; summary: string; title: string };
}) {
  return (
    <>
      <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-brand-primary">
        {topic.category}
      </span>
      <h3 className="mt-1 text-base font-extrabold text-brand-deep">
        {topic.title}
      </h3>
      <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
        {topic.summary}
      </p>
    </>
  );
}
