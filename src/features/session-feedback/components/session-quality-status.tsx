import Link from "next/link";
import type { Route } from "next";
import { routes } from "@/lib/routes";
import type { SessionFeedbackReadPayload } from "../session-feedback.types";

export function SessionQualityStatus({ payload, actorRole }: {
  payload?: SessionFeedbackReadPayload;
  actorRole: "patient" | "therapist";
}) {
  if (payload?.realizationStatus !== "performed") return null;
  const review = payload.qualityReview;
  const subject = actorRole === "patient" ? "Encontro" : "Sessão";
  const title = review?.isOpen ? `${subject} realizado, em análise` : `${subject} realizado`;
  const confirmation = payload.actorConfirmation;
  const ticketHref = payload.supportTicketId
    ? actorRole === "patient" ? routes.patient.supportTicketDetail(payload.supportTicketId)
      : routes.therapist.supportTicketDetail(payload.supportTicketId) : null;
  return (
    <section aria-label="Realização, qualidade e confirmação" className="grid gap-2 rounded-card border border-brand-lavender bg-white p-5 text-sm font-semibold leading-6">
      <h2 className="text-base font-extrabold text-brand-deep">{title}</h2>
      {review?.isOpen ? <p>{review.overdue
        ? "O prazo de 5 dias do TES venceu. A análise continua aberta e a equipe foi alertada."
        : "O TES responderá pelo suporte em até 5 dias corridos após o relato."}</p> : null}
      <p>{confirmation ? "Sua participação está confirmada."
        : `Sua confirmação ainda está pendente. Você pode responder até ${actorRole === "patient" ? "7" : "30"} dias após o fim ${actorRole === "patient" ? "do encontro" : "da sessão"}.`}</p>
      {ticketHref ? <Link className="inline-flex min-h-11 items-center font-extrabold text-brand-primary underline" href={ticketHref as Route<string>}>Acompanhar meu relato no suporte</Link> : null}
    </section>
  );
}
