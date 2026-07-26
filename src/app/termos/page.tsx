import type { Metadata } from "next";

import { PublicInfoLayout } from "@/features/public-support/public-info-layout";

export const metadata: Metadata = {
  description: "Termos públicos do Terapeuta Eu Sou.",
  title: "Termos de uso | Terapeuta Eu Sou",
};

export default function TermsPage() {
  return (
    <PublicInfoLayout eyebrow="Legal" title="Termos de uso">
      <article className="rounded-card border border-brand-lavender bg-white p-6 text-sm font-semibold leading-7 text-tesText-secondary shadow-card">
        <h2 className="text-xl font-extrabold text-brand-deep">
          Sessões online
        </h2>
        <p className="mt-3">
          As sessões online dependem de provedor externo de videoconferência.
          Nesta fase, o Zoom Video SDK é usado para operar áudio e vídeo dentro
          do site depois da confirmação de pagamento.
        </p>
        <h2 className="mt-6 text-xl font-extrabold text-brand-deep">
          Informações legais pendentes
        </h2>
        <p className="mt-3">
          Razão social, CNPJ, foro, endereço e revisão jurídica final não foram
          identificados nos arquivos analisados. Esses campos exigem validação
          de produto e jurídico antes de publicação final.
        </p>
        <h2 className="mt-6 text-xl font-extrabold text-brand-deep">
          Uso responsável
        </h2>
        <p className="mt-3">
          O Terapeuta Eu Sou organiza descoberta, reserva, pagamento e acesso
          operacional a sessões. A plataforma não promete cura, diagnóstico ou
          resultado garantido.
        </p>
      </article>
    </PublicInfoLayout>
  );
}
