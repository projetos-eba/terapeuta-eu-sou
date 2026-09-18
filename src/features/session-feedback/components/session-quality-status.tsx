import Link from "next/link";
import type { Route } from "next";
import { routes } from "@/lib/routes";
import type { SessionFeedbackReadPayload } from "../session-feedback.types";

export function SessionQualityStatus({
  payload,
  actorRole,
}: {
  payload?: SessionFeedbackReadPayload;
  actorRole: "patient" | "therapist";
}) {
  if (payload?.realizationStatus !== "performed") return null;
  const review = payload.qualityReview;
  const subject = actorRole === "patient" ? "Encontro" : "Sessão";
  const title = `${subject} realizado`;
  const ticketHref = payload.supportTicketId
    ? actorRole === "patient"
      ? routes.patient.supportTicketDetail(payload.supportTicketId)
      : routes.therapist.supportTicketDetail(payload.supportTicketId)
    : null;
  return (
    <section
      aria-label="Realização e qualidade da sessão"
      className="grid gap-2 rounded-card border border-brand-lavender bg-white p-5 text-sm font-semibold leading-6"
    >
      <h2 className="text-base font-extrabold text-brand-deep">{title}</h2>
      {payload.feedback ? <p>Sua avaliação foi registrada.</p> : null}
      {review?.isOpen ? (
        <p>
          {review.overdue
            ? "O prazo de 5 dias do TES venceu. A análise continua aberta e a equipe foi alertada."
            : "Seu relato foi encaminhado ao Suporte TES. A equipe responderá em até 5 dias corridos."}
        </p>
      ) : null}
      {ticketHref ? (
        <Link
          className="inline-flex min-h-11 items-center font-extrabold text-brand-primary underline"
          href={ticketHref as Route<string>}
        >
          Acompanhar meu relato no suporte
        </Link>
      ) : null}
    </section>
  );
}
