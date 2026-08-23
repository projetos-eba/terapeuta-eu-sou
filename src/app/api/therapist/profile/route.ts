import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  parseTherapistProfileCommand,
  TherapistProfileContractError,
} from "@/features/therapist-profile-editor";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return failure("Envie os dados em formato válido.", 400);
  }

  let command: ReturnType<typeof parseTherapistProfileCommand>;

  try {
    command = parseTherapistProfileCommand(rawBody);
  } catch (error) {
    if (error instanceof TherapistProfileContractError) {
      return failure(getContractValidationMessage(error.reason), 422, {
        code: "VALIDATION_ERROR",
      });
    }
    return failure("Não foi possível validar o perfil.", 422, {
      code: "VALIDATION_ERROR",
    });
  }

  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_therapist_access_token")?.value;

  if (!config || !accessToken) {
    return failure("Entre na sua conta para continuar.", 401, {
      code: "FORBIDDEN",
    });
  }

  try {
    const response = await fetch(
      `${config.url}/functions/v1/therapist-profile-command`,
      {
        body: JSON.stringify(command),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    const payload = (await response.json().catch(() => null)) as unknown;

    if (response.ok && isPublicInvalidatingAction(command.action)) {
      revalidateTag("therapist-profile");
      revalidateTag("therapist-search");
      revalidatePath("/terapeutas");
      revalidatePath("/terapeutas/[slug]", "page");
      revalidatePath("/");
    }

    return NextResponse.json(payload ?? { ok: false }, {
      headers: noStoreHeaders,
      status: response.status,
    });
  } catch {
    return failure("Não foi possível atualizar o perfil agora.", 503, {
      code: "UNAVAILABLE",
    });
  }
}

function getContractValidationMessage(reason: string) {
  switch (reason) {
    case "public_name":
      return "Informe um nome de perfil entre 2 e 120 caracteres.";
    case "short_intro":
      return "Sua apresentação deve respeitar o limite de 280 caracteres.";
    case "bio":
    case "essence_body":
      return "Revise o texto da sua essência e mantenha-o dentro do limite permitido.";
    case "headline":
      return "O destaque do perfil deve respeitar o limite de 180 caracteres.";
    case "invitation_body":
      return "O convite do perfil deve respeitar o limite de 600 caracteres.";
    case "city":
    case "state":
      return "Revise cidade e estado antes de salvar.";
    case "photo_url":
      return "A foto do perfil precisa ser uma imagem válida.";
    case "video_thumbnail_url":
      return "A capa do vídeo precisa ser uma imagem válida.";
    case "video_title":
      return "O título do vídeo deve respeitar o limite de 120 caracteres.";
    case "experience_years":
      return "Informe uma experiência entre 0 e 80 anos.";
    case "action":
    case "request":
      return "Atualize a página e tente salvar novamente.";
    case "video_url":
      return "Use um link https:// do YouTube ou Vimeo, ou envie um vídeo válido.";
    case "video_provider":
      return "Escolha uma forma válida para o vídeo antes de salvar.";
    case "public_profile_theme":
      return "Escolha um visual válido para o seu perfil antes de salvar.";
    case "bio_illustration_id":
      return "Escolha uma ilustração válida para o seu perfil.";
    case "guide_items":
      return "Revise os itens de Como posso te guiar: são permitidos até 6 itens com texto de até 80 caracteres.";
    case "reflections":
      return "Revise os conteúdos e reflexões: são permitidos até 6 itens com títulos válidos.";
    case "expected_version":
      return "Seu perfil mudou em outra sessão. Atualize a página e tente novamente.";
    case "request_id":
      return "A solicitação expirou. Atualize a página e tente novamente.";
    case "slug":
      return "Informe um endereço público válido para o perfil.";
    default:
      return "Revise os dados do perfil destacados antes de salvar.";
  }
}

function failure(
  message: string,
  status: number,
  options: { code?: string } = {},
) {
  return NextResponse.json(
    { ok: false, error: { code: options.code, message } },
    { headers: noStoreHeaders, status },
  );
}

function isPublicInvalidatingAction(action: string) {
  return (
    action === "publish" || action === "unpublish" || action === "update_slug"
  );
}
