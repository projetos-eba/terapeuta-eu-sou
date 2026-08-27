import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  isSupportMatrixPublishable,
  supportMatrix,
} from "@/domain/legal/legal-registry";
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

const publicSupportFaqs: Record<string, PublicSupportFaq> = {
  account_access: {
    question: "Não consigo acessar minha conta. E agora?",
    intro:
      "Entre pela opção correspondente ao seu perfil e conte para a gente o que aconteceu. Se não conseguir entrar, informe isso na sua mensagem.",
    details: [
      {
        label: "Quando recebo uma resposta?",
        value:
          "Nossa equipe vai analisar sua mensagem e responder assim que possível.",
      },
      {
        label: "Como acompanho o atendimento?",
        value:
          "Você receberá um número de acompanhamento para consultar sua solicitação.",
      },
      {
        label: "Posso enviar mais informações?",
        value:
          "Sim. Se necessário, você poderá complementar a mensagem na mesma conversa.",
      },
    ],
  },
  encounter_urgent: {
    question: "Tive um problema durante o encontro. O que faço?",
    intro:
      "Avise nossa equipe assim que puder e explique o que aconteceu. Vamos olhar sua situação com atenção.",
    details: [
      {
        label: "Quando recebo uma resposta?",
        value:
          "Esse tipo de situação recebe atenção prioritária da nossa equipe.",
      },
      {
        label: "O que devo informar?",
        value:
          "Conte o que aconteceu, quando ocorreu e se o encontro foi interrompido.",
      },
      {
        label: "Como acompanho o atendimento?",
        value:
          "Você receberá um número de acompanhamento para consultar sua solicitação.",
      },
    ],
  },
  payment_refund: {
    question: "Preciso de ajuda com pagamento, cancelamento ou reembolso.",
    intro:
      "Explique sua dúvida com o máximo de detalhes possível para que a equipe consiga ajudar com mais agilidade.",
    details: [
      {
        label: "O que devo informar?",
        value:
          "Se puder, informe a data do atendimento e o que aconteceu com o pagamento.",
      },
      {
        label: "Quando recebo uma resposta?",
        value:
          "Nossa equipe vai conferir sua solicitação e responder assim que possível.",
      },
      {
        label: "Como acompanho o atendimento?",
        value:
          "Você receberá um número de acompanhamento para consultar sua solicitação.",
      },
    ],
  },
  privacy_request: {
    question: "Quero saber mais sobre meus dados e minha privacidade.",
    intro:
      "Conte para a gente qual informação você precisa consultar, corrigir ou solicitar.",
    details: [
      {
        label: "O que pode ser solicitado?",
        value:
          "Nossa equipe orientará você sobre o pedido e os próximos passos.",
      },
      {
        label: "Por que preciso confirmar minha identidade?",
        value: "Essa confirmação ajuda a proteger suas informações pessoais.",
      },
      {
        label: "Como acompanho o atendimento?",
        value:
          "Você receberá um número de acompanhamento para consultar sua solicitação.",
      },
    ],
  },
  security_report: {
    question:
      "Percebi algo estranho ou quero relatar um problema de segurança.",
    intro:
      "Avise nossa equipe o quanto antes e descreva a situação com os detalhes que você tiver.",
    details: [
      {
        label: "O que devo informar?",
        value:
          "Conte o que aconteceu, quando percebeu o problema e quais pessoas podem ter sido afetadas.",
      },
      {
        label: "Quando recebo uma resposta?",
        value: "Situações que envolvem segurança recebem atenção prioritária.",
      },
      {
        label: "Como acompanho o atendimento?",
        value:
          "Você receberá um número de acompanhamento para consultar sua solicitação.",
      },
    ],
  },
};

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
      <section className="rounded-card border border-brand-lavender bg-white p-6 shadow-card sm:p-8">
        <div className="grid gap-5 md:grid-cols-[1fr_280px]">
          <div>
            <h2 className="text-xl font-extrabold text-brand-deep">
              Como podemos ajudar?
            </h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-tesText-secondary">
              Entre na sua conta e fale com nossa equipe. Assim conseguimos
              acompanhar sua mensagem com segurança e manter você informado
              sobre cada etapa.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
            <Link
              className="rounded-full bg-brand-primary px-5 py-3 text-center text-sm font-extrabold text-white transition hover:bg-brand-deep"
              href={routes.public.clientSignIn as Route}
            >
              Entrar como cliente
            </Link>
            <Link
              className="rounded-full border border-brand-primary px-5 py-3 text-center text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft"
              href={routes.public.therapistSignIn as Route}
            >
              Entrar como terapeuta
            </Link>
          </div>
        </div>
        <div className="mt-8 grid gap-3">
          {supportMatrix.map((item) => (
            <PublicSupportFaqItem key={item.categoryKey} item={item} />
          ))}
        </div>
      </section>
    </PublicInfoLayout>
  );
}

function PublicSupportFaqItem({
  item,
}: {
  item: { categoryKey: string; label: string };
}) {
  const copy =
    publicSupportFaqs[item.categoryKey] ??
    ({
      question: item.label,
      intro:
        "Entre na sua conta e conte para a gente como podemos ajudar. Nossa equipe vai analisar sua mensagem com atenção.",
      details: [
        {
          label: "Quando recebo uma resposta?",
          value: "Nossa equipe responderá assim que possível.",
        },
        {
          label: "Como acompanho o atendimento?",
          value:
            "Você receberá um número de acompanhamento para consultar sua solicitação.",
        },
      ],
    } satisfies PublicSupportFaq);

  return (
    <details className="group rounded-2xl border border-brand-lavender bg-surface-muted px-4 open:bg-white sm:px-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-extrabold text-brand-deep [&::-webkit-details-marker]:hidden">
        {copy.question}
        <span aria-hidden="true" className="text-brand-primary">
          +
        </span>
      </summary>
      <div className="border-t border-brand-lavender pb-5 pt-4">
        <p className="text-sm font-semibold leading-6 text-tesText-secondary">
          {copy.intro}
        </p>
        <dl className="mt-4 grid gap-3 text-sm font-semibold leading-6 text-tesText-secondary sm:grid-cols-2">
          {copy.details.map((detail) => (
            <SupportDetail
              key={detail.label}
              label={detail.label}
              value={detail.value}
            />
          ))}
        </dl>
      </div>
    </details>
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
