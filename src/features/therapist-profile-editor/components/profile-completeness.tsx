import Link from "next/link";
import { Star } from "lucide-react";

import { routes } from "@/lib/routes";

import type { TherapistProfileEditorData } from "../therapist-profile-editor.types";
import { ProfileInfoBanner, ProfileSection } from "./profile-section";

export function ProfileCompleteness({
  editor,
}: {
  editor: TherapistProfileEditorData;
}) {
  const percent = Math.min(100, Math.max(0, editor.completeness.percent));

  return (
    <ProfileInfoBanner
      icon={<Star aria-hidden="true" className="size-6" />}
      title="Um perfil completo ajuda as pessoas a entenderem como você trabalha."
    >
      Conte com clareza o que você oferece, como trabalha e o que a pessoa pode
      esperar do primeiro contato.
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-sm font-bold text-brand-deep">Perfil completo</p>
          <div
            aria-label={`Progresso do perfil: ${percent}% completo`}
            className="mt-2 h-3 overflow-hidden rounded-full bg-brand-lavenderSoft"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div
              className="h-full rounded-full bg-brand-primary"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <p className="text-sm font-extrabold text-brand-primary">
          {percent}% completo
        </p>
      </div>
    </ProfileInfoBanner>
  );
}

export function ProfileCompletenessChecklist({
  editor,
}: {
  editor: TherapistProfileEditorData;
}) {
  return (
    <ProfileSection
      description="Preencha estes pontos para deixar seu perfil claro e acolhedor."
      title="O que falta no seu perfil"
    >
      <ul className="grid gap-4">
        {editor.completeness.items.map((item) => (
          <li className="flex items-start gap-3" key={item.key}>
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-status-success/40 bg-status-successBg text-status-success">
              ✓
            </span>
            <div>
              <p className="text-sm font-extrabold leading-6 text-brand-deep">
                {item.label}
              </p>
              <p className="text-sm font-semibold leading-6 text-tesText-secondary">
                {item.complete
                  ? "Tudo certo por aqui."
                  : "Falta preencher este item."}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <Link
        className="mt-5 inline-flex min-h-11 items-center text-sm font-extrabold text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
        href={routes.therapist.assessorIa}
      >
        Ver mais dicas com o Assessor Aura →
      </Link>
    </ProfileSection>
  );
}
