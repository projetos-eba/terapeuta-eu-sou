import Image from "next/image";
import type { AdminProfessionalProfileReview } from "../admin-operations.types";

export function AdminProfileReviewPanel({
  review,
}: {
  review: AdminProfessionalProfileReview | null | undefined;
}) {
  if (!review) {
    return (
      <section className="border-l-4 border-status-warning bg-status-warningBg px-5 py-5 sm:px-6">
        <h2 className="text-lg font-extrabold text-brand-deep">
          Conteúdo do perfil indisponível
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          A prévia da versão enviada não pôde ser carregada agora. A decisão
          administrativa continua disponível quando a leitura for restaurada.
        </p>
      </section>
    );
  }

  const { fields } = review;
  const statusLabel =
    review.verificationStatus === "submitted"
      ? "Aguardando análise"
      : review.verificationStatus === "in_review"
        ? "Em análise"
        : review.verificationStatus === "approved"
          ? "Aprovado"
          : "Versão enviada";

  return (
    <section
      aria-labelledby="profile-review-title"
      className="rounded-[28px] border border-brand-lavender bg-white p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-primary sm:text-xs">
            Moderação do perfil
          </p>
          <h2
            className="mt-2 text-xl font-extrabold text-brand-deep sm:text-2xl"
            id="profile-review-title"
          >
            Conteúdo enviado para revisão
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary">
            Esta é a versão que ficará pública somente depois da decisão da
            equipe TES. Enquanto a análise estiver pendente, o perfil segue
            oculto para pacientes.
          </p>
        </div>
        <span className="inline-flex min-h-9 items-center rounded-full bg-status-warningBg px-3 text-sm font-extrabold text-status-warning">
          {statusLabel}
        </span>
      </div>

      <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-6">
          <ReviewField label="Nome público" value={fields.publicName} />
          <ReviewField label="Sua apresentação" value={fields.shortIntro} />
          <ReviewField label="Minha essência" value={fields.essenceBody} />
          <ReviewField label="Apresentação" value={fields.invitationBody} />
          {fields.guideItems.length > 0 ? (
            <div>
              <p className="text-sm font-extrabold text-brand-deep">
                Como posso te guiar
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {fields.guideItems.map((item) => (
                  <li
                    className="rounded-full bg-brand-lavenderSoft px-3 py-2 text-sm font-bold text-brand-primary"
                    key={item.label}
                  >
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {fields.videoUrl ? (
            <div className="rounded-2xl border border-border bg-surface-soft p-4">
              <p className="text-sm font-extrabold text-brand-deep">
                Vídeo de apresentação
              </p>
              {fields.videoTitle ? (
                <p className="mt-1 text-sm font-semibold text-tesText-secondary">
                  {fields.videoTitle}
                </p>
              ) : null}
              <a
                className="mt-3 inline-flex min-h-11 items-center text-sm font-extrabold text-brand-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
                href={fields.videoUrl}
                rel="noreferrer"
                target="_blank"
              >
                Abrir vídeo hospedado externamente
              </a>
              <p className="mt-2 text-xs font-semibold leading-5 text-tesText-muted">
                Provedor informado: {videoProviderLabel(fields.videoProvider)}.
                O link foi validado no servidor antes de entrar nesta análise.
              </p>
            </div>
          ) : null}
        </div>

        <aside className="space-y-5">
          {review.privateIdentity ? (
            <div className="rounded-2xl border border-status-warning/30 bg-status-warningBg p-4">
              <p className="text-sm font-extrabold text-brand-deep">
                Dados privados de validação
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-tesText-secondary">
                Visíveis somente para a equipe TES autorizada.
              </p>
              <dl className="mt-3 grid gap-2 text-sm">
                <ReviewFact
                  label={documentLabel(review.privateIdentity.documentType)}
                  value={review.privateIdentity.documentNumber}
                />
                <ReviewFact
                  label="Endereço"
                  value={formatAddress(review.privateIdentity)}
                />
              </dl>
            </div>
          ) : null}
          {fields.photoUrl ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface-soft p-2">
              <Image
                alt="Foto enviada no perfil"
                className="aspect-square w-full rounded-xl object-cover"
                height={520}
                src={fields.photoUrl}
                width={520}
              />
            </div>
          ) : null}
          <div>
            <p className="text-sm font-extrabold text-brand-deep">
              Serviços e terapias
            </p>
            {review.services.length > 0 ? (
              <ul className="mt-3 divide-y divide-border border-y border-border">
                {review.services.map((service, index) => (
                  <li className="py-3" key={`${service.title}-${index}`}>
                    <p className="text-sm font-extrabold text-brand-deep">
                      {service.title || service.therapyName || "Serviço"}
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-tesText-secondary">
                      {service.therapyName || "Terapia"} ·{" "}
                      {service.durationMinutes ?? "—"} min
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                Nenhum serviço cadastrado para revisão.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function ReviewField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <div>
      <p className="text-sm font-extrabold text-brand-deep">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-7 text-tesText-secondary">
        {value}
      </p>
    </div>
  );
}

function videoProviderLabel(
  value: AdminProfessionalProfileReview["fields"]["videoProvider"],
) {
  if (value === "youtube") return "YouTube";
  if (value === "vimeo") return "Vimeo";
  if (value === "upload") return "arquivo enviado";
  return "link externo";
}

function documentLabel(value: "cpf" | "rg" | "passport" | null) {
  if (value === "cpf") return "CPF";
  if (value === "rg") return "RG";
  if (value === "passport") return "Passaporte";
  return "Documento";
}

function formatAddress(
  identity: NonNullable<AdminProfessionalProfileReview["privateIdentity"]>,
) {
  const line = [identity.street, identity.streetNumber, identity.complement]
    .filter(Boolean)
    .join(", ");
  const locality = [identity.neighborhood, identity.city, identity.state]
    .filter(Boolean)
    .join(" · ");
  return [line, locality, identity.postalCode].filter(Boolean).join(" — ");
}

function ReviewFact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="font-extrabold text-brand-deep">{label}</dt>
      <dd className="mt-0.5 break-words font-semibold text-tesText-secondary">
        {value}
      </dd>
    </div>
  );
}
