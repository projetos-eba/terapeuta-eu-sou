import type { Metadata } from "next";

import { PublicInfoLayout } from "@/features/public-support/public-info-layout";

export const metadata: Metadata = {
  description: "Guia público para entrada em sessões online pelo Zoom.",
  title: "Ajuda com Zoom | Terapeuta Eu Sou",
};

const sections = [
  {
    body: "Use um navegador atualizado, uma conexão estável e permita câmera e microfone quando o navegador solicitar.",
    title: "Antes de entrar",
  },
  {
    body: "A sessão usa sala de espera. Aguarde a entrada ser liberada pelo terapeuta responsável.",
    title: "Sala de espera",
  },
  {
    body: "Se o áudio ou vídeo não abrir, confira as permissões do navegador e se outro aplicativo já está usando câmera ou microfone.",
    title: "Áudio e vídeo",
  },
  {
    body: "Feche abas pesadas, aproxime-se do roteador ou troque para uma rede mais estável antes de tentar novamente.",
    title: "Conexão instável",
  },
  {
    body: "A gravação automática fica desativada por padrão. O TES não armazena áudio, vídeo, chat ou transcrição nesta fase.",
    title: "Gravação",
  },
  {
    body: "A sala é liberada perto do horário e depende da confirmação de pagamento. Se a mensagem persistir, acesse o suporte pela área logada.",
    title: "Sala indisponível",
  },
];

export default function ZoomHelpPage() {
  return (
    <PublicInfoLayout eyebrow="Sessões online" title="Ajuda com Zoom">
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <section
            className="rounded-card border border-brand-lavender bg-white p-6 shadow-card"
            key={section.title}
          >
            <h2 className="text-xl font-extrabold text-brand-deep">
              {section.title}
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </PublicInfoLayout>
  );
}
