import type { Metadata } from "next";

import { PublicInfoLayout } from "@/features/public-support/public-info-layout";

export const metadata: Metadata = {
  description: "Política pública de privacidade do Terapeuta Eu Sou.",
  title: "Privacidade | Terapeuta Eu Sou",
};

export default function PrivacyPage() {
  return (
    <PublicInfoLayout eyebrow="Privacidade" title="Como tratamos seus dados">
      <article className="rounded-card border border-brand-lavender bg-white p-6 text-sm font-semibold leading-7 text-tesText-secondary shadow-card">
        <h2 className="text-xl font-extrabold text-brand-deep">
          Videoconferência
        </h2>
        <p className="mt-3">
          Para operar sessões online, usamos Zoom Video SDK e enviamos ao Zoom
          apenas dados mínimos e operacionais, como identificadores opacos da
          sessão, nome exibido limitado e eventos técnicos de entrada e saída.
        </p>
        <p className="mt-3">
          Câmera e microfone são processados pelo Zoom durante a chamada. O TES
          não armazena áudio, vídeo, chat ou transcrição nesta fase, e a
          gravação automática permanece desativada por padrão.
        </p>
        <h2 className="mt-6 text-xl font-extrabold text-brand-deep">
          Webhooks e presença operacional
        </h2>
        <p className="mt-3">
          Webhooks podem registrar status da sessão e evidências operacionais de
          presença, sem inferir identidade por nome e sem armazenar conteúdo da
          sessão.
        </p>
        <h2 className="mt-6 text-xl font-extrabold text-brand-deep">
          Retenção
        </h2>
        <p className="mt-3">
          A política final de retenção ainda depende de aprovação legal e de
          produto. Até essa definição, a implementação minimiza payloads brutos
          e privilegia hashes e campos operacionais.
        </p>
      </article>
    </PublicInfoLayout>
  );
}
