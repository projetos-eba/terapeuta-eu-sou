import type { Metadata } from "next";

import { ForTherapistsPage } from "@/features/for-therapists";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  alternates: {
    canonical: routes.public.forTherapists,
  },
  description:
    "Conheça o espaço do Terapeuta Eu Sou para terapeutas organizarem atendimentos, presença profissional e planos com clareza.",
  openGraph: {
    description:
      "Uma landing pública para terapeutas conhecerem recursos, planos e caminhos de cadastro no TES.",
    title: "Para Terapeutas | Terapeuta Eu Sou",
    type: "website",
    url: routes.public.forTherapists,
  },
  title: "Para Terapeutas | Terapeuta Eu Sou",
};

export default function ParaTerapeutasPage() {
  return <ForTherapistsPage />;
}
