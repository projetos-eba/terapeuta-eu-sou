import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getDefaultMessage,
  mutateTherapistReviewReply,
  parseTherapistReviewCommand,
  TherapistReviewsContractError,
  TherapistReviewsError,
} from "@/features/therapist-reviews";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return failure(
      "Envie os dados em formato válido.",
      400,
      "VALIDATION_ERROR",
    );
  }

  let command: ReturnType<typeof parseTherapistReviewCommand>;

  try {
    command = parseTherapistReviewCommand(rawBody);
  } catch (error) {
    if (error instanceof TherapistReviewsContractError) {
      return failure("Revise os dados da resposta.", 422, "VALIDATION_ERROR");
    }
    return failure("Não foi possível validar a resposta.", 422);
  }

  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_therapist_access_token")?.value;

  if (!config || !accessToken) {
    return failure(
      "Entre na sua conta para continuar.",
      401,
      "SESSION_EXPIRED",
    );
  }

  try {
    const data = await mutateTherapistReviewReply({
      accessToken,
      body: command.body,
      requestId: command.requestId,
      reviewId: command.reviewId,
    });

    revalidateTag("therapist-profile");
    revalidateTag("therapist-search");
    revalidatePath("/terapeutas");
    revalidatePath("/terapeutas/[slug]", "page");

    return NextResponse.json(
      { data, ok: true },
      { headers: noStoreHeaders, status: 200 },
    );
  } catch (error) {
    if (error instanceof TherapistReviewsError) {
      return failure(
        getDefaultMessage(error.code),
        getStatus(error.code),
        toPublicCode(error.code),
      );
    }

    return failure(
      "Não foi possível atualizar as avaliações agora.",
      503,
      "UNAVAILABLE",
    );
  }
}

function failure(message: string, status: number, code = "UNAVAILABLE") {
  return NextResponse.json(
    { error: { code, message }, ok: false },
    { headers: noStoreHeaders, status },
  );
}

function getStatus(code: TherapistReviewsError["code"]) {
  if (code === "session_expired") return 401;
  if (code === "forbidden") return 403;
  if (code === "review_not_found") return 404;
  if (code === "request_conflict") return 409;
  if (code === "validation_error") return 422;
  return 503;
}

function toPublicCode(code: TherapistReviewsError["code"]) {
  const map: Record<TherapistReviewsError["code"], string> = {
    forbidden: "FORBIDDEN",
    invalid_payload: "VALIDATION_ERROR",
    network_error: "UNAVAILABLE",
    request_conflict: "REQUEST_CONFLICT",
    review_not_found: "REVIEW_NOT_FOUND",
    session_expired: "SESSION_EXPIRED",
    unavailable: "UNAVAILABLE",
    validation_error: "VALIDATION_ERROR",
  };

  return map[code];
}
