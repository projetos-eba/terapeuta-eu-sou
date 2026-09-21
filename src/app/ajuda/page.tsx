import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isSupportMatrixPublishable } from "@/domain/legal/legal-registry";
import { PublicInfoLayout } from "@/features/public-support/public-info-layout";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  description: "Central pública de ajuda do Terapeuta Eu Sou.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Ajuda | Terapeuta Eu Sou",
};

type PublicSupportFaq = {
  question: string;
  intro: string;
  details: Array<{ label: string; value: string }>;
};

const publicSupportFaqs: PublicSupportFaq[] = [
  {
    question: "Não consigo acessar minha conta. E agora?",
    intro:
      "Você pode recuperar seu acesso de forma rápida e segura. Se ainda assim não conseguir, fale com nosso suporte que vamos te ajudar.",
    details: [
      {
        label: "O que devo fazer?",
        value:
          "Use a opção “Esqueci minha senha” na tela de login e siga as instruções enviadas para o seu e-mail.",
      },
      {
        label: "Como falo com o suporte?",
        value:
          "Acesse sua conta e abra um chamado pelo chat de ajuda. Nossa equipe responderá assim que possível.",
      },
      {
        label: "Ainda não consegui entrar. E agora?",
        value:
          "Verifique sua caixa de spam ou tente novamente. Se o problema continuar, fale com o suporte.",
      },
      {
        label: "Quando recebo uma resposta?",
        value:
          "Normalmente respondemos em até 24 horas úteis. Você será avisado por e-mail e pelo chat.",
      },
    ],
  },
  {
    question: "Tive um problema durante o encontro. O que faço?",
    intro:
      "Queremos saber o que aconteceu para que possamos te ajudar da melhor forma. Conte com o apoio do TES.",
    details: [
      {
        label: "O que devo informar?",
        value:
          "Conte o que ocorreu com o máximo de detalhes possível: data, horário, nome do terapeuta e descrição do problema.",
      },
      {
        label: "Quando recebo uma resposta?",
        value:
          "Nossa equipe vai analisar o caso com atenção e responderá o mais breve possível.",
      },
      {
        label: "Como acompanho o atendimento?",
        value:
          "Após enviar sua mensagem, você receberá um número de acompanhamento para consultar o andamento do seu chamado.",
      },
      {
        label: "Posso enviar mais informações?",
        value:
          "Sim. Se tiver novas informações ou arquivos que possam ajudar, basta responder ao chamado.",
      },
    ],
  },
  {
    question: "Preciso de ajuda com pagamento, cancelamento ou reembolso.",
    intro:
      "As opções disponíveis podem variar conforme as condições do seu agendamento. Estamos aqui para orientar você.",
    details: [
      {
        label: "O que devo informar?",
        value:
          "Informe a data do atendimento, o que aconteceu e o motivo da solicitação.",
      },
      {
        label: "Quando recebo uma resposta?",
        value:
          "Nossa equipe vai analisar sua solicitação e responder assim que possível.",
      },
      {
        label: "Como acompanho o atendimento?",
        value:
          "Você receberá um número de acompanhamento para consultar o andamento da sua solicitação.",
      },
      {
        label: "As opções disponíveis podem variar?",
        value:
          "Sim. As opções de cancelamento, reagendamento ou reembolso dependem das condições do seu agendamento. Você verá o que está disponível antes de concluir a solicitação.",
      },
    ],
  },
  {
    question: "Quero saber mais sobre meus dados e minha privacidade.",
    intro:
      "Levamos a proteção dos seus dados muito a sério. Veja como funciona.",
    details: [
      {
        label: "O que pode ser solicitado?",
        value:
          "Você pode solicitar acesso, correção ou exclusão dos seus dados pessoais a qualquer momento.",
      },
      {
        label: "Por que preciso confirmar minha identidade?",
        value:
          "Essa confirmação é necessária para proteger suas informações e garantir que estamos falando com você.",
      },
      {
        label: "Como faço uma solicitação?",
        value:
          "Abra um chamado pelo chat de ajuda informando sua solicitação. Nossa equipe orientará você.",
      },
      {
        label: "Onde encontro mais informações?",
        value:
          "Acesse nossa Política de Privacidade para saber todos os detalhes sobre coleta, uso e proteção dos seus dados.",
      },
    ],
  },
];

export default function HelpPage() {
  if (!isSupportMatrixPublishable()) {
    if (isProductionRuntime()) {
      notFound();
    }

    return (
      <PublicInfoLayout eyebrow="Ajuda" title="Central de ajuda">
        <section className="rounded-card border border-brand-lavender bg-white p-6 shadow-card">
          <p className="text-sm font-semibold leading-7 text-tesText-secondary">
            A central pública ficará disponível assim que os canais, horários e
            prazos de atendimento forem confirmados.
          </p>
        </section>
      </PublicInfoLayout>
    );
  }

  return (
    <PublicInfoLayout eyebrow="Ajuda" title="Central de ajuda">
      <section className="rounded-xl border border-brand-lavender bg-white p-5 shadow-card sm:p-6">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_216px] sm:items-center sm:gap-8">
          <div>
            <h2 className="text-lg font-extrabold text-brand-deep">
              Como podemos ajudar?
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              Encontre aqui respostas para as dúvidas mais comuns sobre sua
              conta, sessões, pagamentos e uso do TES. Se ainda precisar de
              ajuda, nossa equipe está por perto.
            </p>
          </div>
          <div className="grid gap-2.5">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-primary px-5 py-3 text-center text-sm font-extrabold text-white transition hover:bg-brand-deep"
              href={routes.public.clientSignIn as Route}
            >
              Entrar como cliente
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-primary px-5 py-3 text-center text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft"
              href={routes.public.therapistSignIn as Route}
            >
              Entrar como terapeuta
            </Link>
          </div>
        </div>
        <div className="mt-6 grid gap-2.5">
          {publicSupportFaqs.map((item) => (
            <PublicSupportFaqItem key={item.question} item={item} />
          ))}
        </div>
      </section>
    </PublicInfoLayout>
  );
}

function PublicSupportFaqItem({ item }: { item: PublicSupportFaq }) {
  return (
    <article className="rounded-xl border border-brand-lavender bg-white px-4 py-3.5 sm:px-5 sm:py-4">
      <div className="flex items-start justify-between gap-4 text-sm font-extrabold text-brand-deep sm:text-base">
        <h2>{item.question}</h2>
        <span aria-hidden="true" className="text-brand-primary">
          +
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {item.intro}
      </p>
      <dl className="mt-4 grid gap-x-8 gap-y-4 text-sm font-semibold leading-6 text-tesText-secondary sm:grid-cols-2">
        {item.details.map((detail) => (
          <SupportDetail
            key={detail.label}
            label={detail.label}
            value={detail.value}
          />
        ))}
      </dl>
    </article>
  );
}

function SupportDetail({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <dt className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-tesText-muted">
        {label}
      </dt>
      <dd className="mt-1 text-brand-deep">{value}</dd>
    </div>
  );
}

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}
